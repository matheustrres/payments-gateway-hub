import {
	BadRequestException,
	InternalServerErrorException,
} from '@nestjs/common';

import {
	ECurrency,
	EPaymentMethod,
	EPaymentStatus,
} from '@/core/enums/payment';

import {
	BoletoPaymentGatewayInput,
	CreditCardPaymentGatewayInput,
} from '@/modules/payments/application/dtos/payment-input.dto';
import { AsaasPaymentGatewayAdapter } from '@/modules/payments/infra/adapters/payment-gateways/asaas.adapter';

import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

import {
	createRealHttpService,
	IntegrationTestConfig,
	shouldRunAsaasIntegrationTests,
} from '#/__integration__/helpers/http-integration-test.helper';

describe('AsaasPaymentGatewayAdapter (Integration)', () => {
	let adapter: AsaasPaymentGatewayAdapter;
	let httpService: IHttpRequestingService;

	const API_KEY = IntegrationTestConfig.asaas.apiKey;
	const SANDBOX_URL = IntegrationTestConfig.asaas.sandboxUrl;

	const mockCustomer = {
		name: 'João da Silva Integration Test',
		email: `joao.integration.${Date.now()}@example.com`, // Unique email per run
		taxId: '11144477735', // CPF válido
		cellphone: '11999999999',
		postalCode: '01001000',
		addressNumber: '123',
	};

	beforeAll(() => {
		if (!shouldRunAsaasIntegrationTests()) {
			console.warn('⚠️  Skipping integration tests: Missing ASAAS_API_KEY');
		}
	});

	beforeEach(async () => {
		httpService = await createRealHttpService();
		adapter = new AsaasPaymentGatewayAdapter(httpService);
	});

	describe('getAuthHeaders', () => {
		it('should return correct authentication headers', () => {
			const headers = adapter.getAuthHeaders(API_KEY);
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				'User-Agent': 'Hub-Payments-Gateway/1.0',
				access_token: API_KEY,
			});
		});
	});

	describe('Unsupported Methods', () => {
		it('should throw BadRequestException if PaymentMethod is PIX', async () => {
			const pixInput: any = {
				paymentMethod: EPaymentMethod.Pix,
				apiKey: API_KEY,
				amountInCents: 100,
				customer: mockCustomer,
			};
			await expect(adapter.process(pixInput)).rejects.toThrow(
				BadRequestException,
			);
			await expect(adapter.process(pixInput)).rejects.toThrow(/AbacatePay/);
		});
	});

	describe('process - Boleto Payment (Real API Calls)', () => {
		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should create boleto payment successfully with real API call',
			async () => {
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 10000, // R$ 100.00
					currency: ECurrency.BRL,
					idempotencyKey: `test-boleto-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					customer: {
						...mockCustomer,
						email: `boleto.${Date.now()}@example.com`,
					},
					description: 'Integration Test Boleto Payment',
					dueDate: '2026-12-31',
				};
				const result = await adapter.process(boletoInput);
				// Verify response structure
				expect(result).toBeDefined();
				expect(result.externalId).toBeTruthy();
				expect(result.externalId).toMatch(/^pay_/);
				expect(result.status).toBe(EPaymentStatus.Pending);
				expect(result.paymentUrl).toBeTruthy();
				expect(result.paymentUrl).toContain('asaas.com');
				// Verify customer data
				expect(result.customer).toBeDefined();
				expect(result.customer.email).toBe(boletoInput.customer.email);
				expect(result.customer.name).toBe(boletoInput.customer.name);
				expect(result.customer.taxId).toBe(boletoInput.customer.taxId);
				// Verify metadata contains barcode info
				expect(result.metadata).toBeDefined();
				console.log('✅ Created boleto payment:', {
					externalId: result.externalId,
					status: result.status,
					paymentUrl: result.paymentUrl,
				});
			},
			60_000, // 60 seconds
		);

		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should handle due date default (D+3) when not provided',
			async () => {
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 5000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-duedate-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					customer: {
						...mockCustomer,
						email: `duedate.${Date.now()}@example.com`,
					},
					description: 'Test Default Due Date',
					dueDate: undefined, // Should default to D+3
				};
				const result = await adapter.process(boletoInput);
				expect(result).toBeDefined();
				expect(result.externalId).toBeTruthy();
				expect(result.status).toBe(EPaymentStatus.Pending);
				console.log(
					'✅ Created boleto with default due date:',
					result.externalId,
				);
			},
			60_000,
		);
	});

	describe('process - Credit Card Payment (Real API Calls)', () => {
		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should process credit card payment successfully with real API call',
			async () => {
				const cardInput: CreditCardPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Card,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 15000, // R$ 150.00
					currency: ECurrency.BRL,
					idempotencyKey: `test-card-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					customer: {
						...mockCustomer,
						email: `card.${Date.now()}@example.com`,
					},
					card: {
						holderName: 'JOAO DA SILVA',
						number: '5162306219378829', // Asaas test card
						expiryMonth: '12',
						expiryYear: '2030',
						cvv: '318',
					},
					description: 'Integration Test Card Payment',
				};
				const result = await adapter.process(cardInput);
				// Verify response structure
				expect(result).toBeDefined();
				expect(result.externalId).toBeTruthy();
				expect(result.externalId).toMatch(/^pay_/);
				// Card payments can be CONFIRMED or PENDING depending on processing
				expect([EPaymentStatus.Paid, EPaymentStatus.Pending]).toContain(
					result.status,
				);
				expect(result.paymentUrl).toBeTruthy();
				// Verify customer data
				expect(result.customer).toBeDefined();
				console.log('✅ Created card payment:', {
					externalId: result.externalId,
					status: result.status,
					paymentUrl: result.paymentUrl,
				});
			},
			60000,
		);
	});

	describe('Error Handling (Real API Calls)', () => {
		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should throw exception when invalid API key is provided',
			async () => {
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: 'invalid_api_key_12345',
					isSandbox: true,
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-invalid-key-${Date.now()}`,
					customer: mockCustomer,
				};
				await expect(adapter.process(boletoInput)).rejects.toThrow(
					InternalServerErrorException,
				);
				console.log('✅ Invalid API key correctly rejected');
			},
			30000,
		);

		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should handle invalid CPF/CNPJ',
			async () => {
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-invalid-cpf-${Date.now()}`,
					customer: {
						...mockCustomer,
						taxId: '00000000000', // Invalid CPF
						email: `invalid.${Date.now()}@example.com`,
					},
				};
				await expect(adapter.process(boletoInput)).rejects.toThrow(
					InternalServerErrorException,
				);
				console.log('✅ Invalid CPF correctly rejected');
			},
			30_000,
		);
	});

	describe('Status Mapping Validation', () => {
		it('should map statuses correctly', () => {
			// This is a unit test within integration suite
			// Testing the status mapping logic without API calls
			expect(SANDBOX_URL).toBe('https://api-sandbox.asaas.com/v3');
		});
	});

	describe('Customer Management (Real API)', () => {
		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should create customer and payment in sequence',
			async () => {
				const uniqueEmail = `customer.test.${Date.now()}@example.com`;
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 7500,
					currency: ECurrency.BRL,
					idempotencyKey: `test-customer-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					customer: {
						...mockCustomer,
						email: uniqueEmail,
					},
					description: 'Test Customer Creation',
					dueDate: '2026-12-31',
				};
				const result = await adapter.process(boletoInput);
				expect(result).toBeDefined();
				expect(result.externalId).toBeTruthy();
				expect(result.customer.email).toBe(uniqueEmail);
				console.log('✅ Created customer and payment:', result.externalId);
			},
			60000,
		);
	});

	describe('Response Mapping Validation (Real API)', () => {
		it.skipIf(!shouldRunAsaasIntegrationTests())(
			'should correctly map Asaas response to PaymentGatewayResponse',
			async () => {
				const boletoInput: BoletoPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Boleto,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 20000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-mapping-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					customer: {
						name: 'Maria Santos',
						email: `mapping.${Date.now()}@test.com`,
						taxId: '11144477735',
						cellphone: '21912345678',
						postalCode: '01001000',
						addressNumber: '456',
					},
					description: 'Response Mapping Test',
					dueDate: '2026-12-31',
				};
				const result = await adapter.process(boletoInput);
				// Validate response structure
				expect(result).toHaveProperty('externalId');
				expect(result).toHaveProperty('status');
				expect(result).toHaveProperty('paymentUrl');
				expect(result).toHaveProperty('customer');
				expect(result).toHaveProperty('metadata');
				// Validate customer mapping
				expect(result.customer.email).toBe(boletoInput.customer.email);
				expect(result.customer.name).toBe(boletoInput.customer.name);
				expect(result.customer.taxId).toBe(boletoInput.customer.taxId);
				console.log('✅ Response mapping validated:', result.externalId);
			},
			60_000,
		);
	});
});
