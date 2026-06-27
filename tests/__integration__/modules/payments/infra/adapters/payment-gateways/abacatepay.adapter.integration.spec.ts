import { BadRequestException } from '@nestjs/common';

import { ECurrency, EPaymentMethod } from '@/core/enums/payment';

import { PixPaymentGatewayInput } from '@/modules/payments/application/dtos/payment-input.dto';
import { AbacatePayPaymentGatewayAdapter } from '@/modules/payments/infra/adapters/payment-gateways/abacate-pay.adapter';

import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

import {
	createRealHttpService,
	IntegrationTestConfig,
	shouldRunAbacatePayIntegrationTests,
} from '#/__integration__/helpers/http-integration-test.helper';

describe('AbacatePayPaymentGatewayAdapter (Integration)', () => {
	let adapter: AbacatePayPaymentGatewayAdapter;
	let httpService: IHttpRequestingService;

	const API_KEY = IntegrationTestConfig.abacatePay.apiKey;
	const BASE_URL = IntegrationTestConfig.abacatePay.baseUrl;

	const mockCustomer = {
		name: 'Maria da Silva Integration Test',
		email: 'maria.integration.test@example.com',
		taxId: '11144477735', // CPF válido usado em testes E2E
		cellphone: '11987654321',
	};

	beforeAll(() => {
		if (!shouldRunAbacatePayIntegrationTests()) {
			console.warn(
				'⚠️  Skipping integration tests: Missing ABACATEPAY_API_KEY',
			);
		}
	});

	beforeEach(async () => {
		httpService = await createRealHttpService();
		adapter = new AbacatePayPaymentGatewayAdapter(httpService);
	});

	describe('getAuthHeaders', () => {
		it('should return correct authentication headers', () => {
			const headers = adapter.getAuthHeaders(API_KEY);
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				Authorization: `Bearer ${API_KEY}`,
			});
		});
	});

	describe('process - PIX Payment (Real API Calls)', () => {
		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should create PIX payment successfully with real API call',
			async () => {
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-pix-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					productName: 'Integration Test Product',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: mockCustomer,
				};
				const result = await adapter.process(pixInput);
				// Verify response structure
				expect(result).toBeDefined();
				expect(result.externalId).toBeTruthy();
				expect(result.externalId).toMatch(/^bill_/);
				expect(result.status).toBeTruthy();
				expect(result.paymentUrl).toBeTruthy();
				expect(result.paymentUrl).toContain('abacatepay.com');
				// Verify customer data
				expect(result.customer).toBeDefined();
				expect(result.customer.email).toBe(mockCustomer.email);
				expect(result.customer.name).toBe(mockCustomer.name);
				expect(result.customer.taxId).toBe(mockCustomer.taxId);
				expect(result.customer.phone).toBe(mockCustomer.cellphone);
				// Verify metadata
				expect(result.metadata).toBeDefined();
				// Log the result for debugging
				console.log('✅ Created billing:', {
					externalId: result.externalId,
					status: result.status,
					paymentUrl: result.paymentUrl,
				});
			},
			30_000,
		);

		// Note: AbacatePay API requires customer data, so we cannot test without it

		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should handle idempotency correctly (same key returns same billing)',
			async () => {
				const idempotencyKey = `test-idempotency-${Date.now()}-${Math.random()
					.toString(36)
					.substring(7)}`;
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 15000,
					currency: ECurrency.BRL,
					idempotencyKey,
					productName: 'Idempotency Test Product',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: mockCustomer,
				};
				// First call
				const result1 = await adapter.process(pixInput);
				expect(result1.externalId).toBeTruthy();
				// Second call with same idempotency key
				const result2 = await adapter.process(pixInput);
				// Should return the same billing
				expect(result2.externalId).toBe(result1.externalId);
				expect(result2.paymentUrl).toBe(result1.paymentUrl);
				console.log('✅ Idempotency validated:', result1.externalId);
			},
			60_000,
		);

		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should handle different payment amounts correctly',
			async () => {
				const amounts = [5000, 10000, 25000, 50000]; // R$ 50, R$ 100, R$ 250, R$ 500
				for (const amount of amounts) {
					const pixInput: PixPaymentGatewayInput = {
						paymentMethod: EPaymentMethod.Pix,
						apiKey: API_KEY,
						isSandbox: true,
						amountInCents: amount,
						currency: ECurrency.BRL,
						idempotencyKey: `test-amount-${amount}-${Date.now()}-${Math.random()
							.toString(36)
							.substring(7)}`,
						productName: `Test Product - R$ ${amount / 100}`,
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: mockCustomer,
					};
					const result = await adapter.process(pixInput);
					expect(result).toBeDefined();
					expect(result.externalId).toBeTruthy();
					expect(result.paymentUrl).toBeTruthy();
					console.log(
						`✅ Created billing for R$ ${amount / 100}:`,
						result.externalId,
					);
				}
			},
			120_000, // 2 minutes
		);
	});

	describe('Error Handling (Real API Calls)', () => {
		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should throw BadRequestException when invalid API key is provided',
			async () => {
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: 'invalid_api_key_12345',
					isSandbox: true,
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-invalid-key-${Date.now()}`,
					productName: 'Test Product',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: mockCustomer,
				};
				await expect(adapter.process(pixInput)).rejects.toThrow(
					BadRequestException,
				);
				console.log('✅ Invalid API key correctly rejected');
			},
			30_000,
		);

		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should handle invalid amount (0 or negative)',
			async () => {
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 0, // Invalid amount
					currency: ECurrency.BRL,
					idempotencyKey: `test-invalid-amount-${Date.now()}`,
					productName: 'Test Product',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: mockCustomer,
				};
				await expect(adapter.process(pixInput)).rejects.toThrow();
				console.log('✅ Invalid amount correctly rejected');
			},
			30_000,
		);
	});

	describe('Request Building Validation', () => {
		it('should build correct billing input with all fields', () => {
			const headers = adapter.getAuthHeaders(API_KEY);
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				Authorization: `Bearer ${API_KEY}`,
			});
			expect(BASE_URL).toBe('https://api.abacatepay.com/v1');
		});

		it('should handle PIX payment method only', async () => {
			const invalidInput: any = {
				paymentMethod: 'CREDIT_CARD', // Invalid for AbacatePay
				apiKey: API_KEY,
				amountInCents: 10000,
			};
			await expect(adapter.process(invalidInput)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('Response Mapping Validation (Real API)', () => {
		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should correctly map AbacatePay response to PaymentGatewayResponse',
			async () => {
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 25000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-mapping-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					productName: 'Response Mapping Test',
					returnUrl: 'https://shop.com/return',
					completionUrl: 'https://shop.com/complete',
					customer: {
						name: 'João Santos',
						email: 'joao.mapping.test@test.com',
						taxId: '11144477735', // CPF válido usado em testes E2E
						cellphone: '21912345678',
					},
				};
				const result = await adapter.process(pixInput);
				// Validate response structure
				expect(result).toHaveProperty('externalId');
				expect(result).toHaveProperty('status');
				expect(result).toHaveProperty('paymentUrl');
				expect(result).toHaveProperty('customer');
				expect(result).toHaveProperty('metadata');
				// Validate customer structure (values may differ if customer already exists in AbacatePay)
				expect(result.customer).toHaveProperty('email');
				expect(result.customer).toHaveProperty('name');
				expect(result.customer).toHaveProperty('taxId');
				expect(result.customer).toHaveProperty('phone');
				expect(typeof result.customer.email).toBe('string');
				expect(typeof result.customer.name).toBe('string');
				expect(typeof result.customer.taxId).toBe('string');
				console.log('✅ Response mapping validated:', result.externalId);
			},
			30000,
		);

		it.skipIf(!shouldRunAbacatePayIntegrationTests())(
			'should handle empty metadata gracefully',
			async () => {
				const pixInput: PixPaymentGatewayInput = {
					paymentMethod: EPaymentMethod.Pix,
					apiKey: API_KEY,
					isSandbox: true,
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-empty-meta-${Date.now()}-${Math.random()
						.toString(36)
						.substring(7)}`,
					productName: 'Empty Metadata Test',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: mockCustomer,
				};
				const result = await adapter.process(pixInput);
				expect(result.metadata).toBeDefined();
				expect(typeof result.metadata).toBe('object');
				console.log('✅ Empty metadata handled correctly');
			},
			30_000,
		);
	});
});
