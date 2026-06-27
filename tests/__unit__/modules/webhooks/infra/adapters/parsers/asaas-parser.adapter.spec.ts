import { beforeEach, describe, expect, it } from 'vitest';

import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';

import { NormalizedWebhookEvent } from '@/modules/webhooks/application/ports/webhook-parser.port';
import {
	AsaasWebhookParser,
	AsaasWebhookPayload,
} from '@/modules/webhooks/infra/adapters/parsers/asaas-parser.adapter';

function createValidPayload(
	overrides?: Partial<AsaasWebhookPayload>,
): AsaasWebhookPayload {
	const defaults: AsaasWebhookPayload = {
		id: 'evt_12345',
		event: 'PAYMENT_CONFIRMED',
		dateCreated: '2024-01-01T12:00:00.000Z',
		payment: {
			id: 'pay_12345',
			status: 'CONFIRMED',
			billingType: 'BOLETO',
			value: 100.0,
			netValue: 97.5,
			invoiceUrl: 'https://example.com/invoice/12345',
			bankSlipUrl: 'https://example.com/boleto/12345',
			externalReference: 'order-12345',
		},
	};

	if (!overrides) return defaults;

	const payment =
		'payment' in overrides && overrides.payment
			? ({
					id: overrides.payment.id ?? defaults.payment.id,
					status: overrides.payment.status ?? defaults.payment.status,
					billingType:
						overrides.payment.billingType ?? defaults.payment.billingType,
					value: overrides.payment.value ?? defaults.payment.value,
					netValue: overrides.payment.netValue ?? defaults.payment.netValue,
					invoiceUrl:
						overrides.payment.invoiceUrl ?? defaults.payment.invoiceUrl,
					bankSlipUrl:
						overrides.payment.bankSlipUrl ?? defaults.payment.bankSlipUrl,
					externalReference: overrides.payment.externalReference,
					creditCard: overrides.payment.creditCard,
				} as typeof defaults.payment)
			: defaults.payment;

	return {
		id: 'id' in overrides ? overrides.id : defaults.id,
		event: 'event' in overrides ? overrides.event : defaults.event,
		dateCreated:
			'dateCreated' in overrides ? overrides.dateCreated : defaults.dateCreated,
		payment,
	} as AsaasWebhookPayload;
}

describe(AsaasWebhookParser.name, () => {
	let sut: AsaasWebhookParser;

	beforeEach(() => {
		sut = new AsaasWebhookParser();
	});

	describe('.supports', () => {
		it('should return true for Asaas provider', () => {
			const result = sut.supports(EPaymentProvider.Asaas);
			expect(result).toBe(true);
		});

		it('should return false for AbacatePay provider', () => {
			const result = sut.supports(EPaymentProvider.AbacatePay);
			expect(result).toBe(false);
		});

		it('should return false for Payoneer provider', () => {
			const result = sut.supports(EPaymentProvider.Payoneer);
			expect(result).toBe(false);
		});
	});

	describe('.parse', () => {
		describe('successful parsing - supported events', () => {
			it('should parse PAYMENT_CONFIRMED event correctly', () => {
				const payload = createValidPayload({ event: 'PAYMENT_CONFIRMED' });
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_12345');
				expect(result?.currentStatus).toBe(EPaymentStatus.Paid);
				expect(result?.rawStatus).toBe('CONFIRMED');
				expect(result?.rawEventType).toBe('PAYMENT_CONFIRMED');
				expect(result?.metadata).toMatchObject({
					billingType: 'BOLETO',
					netValue: 97.5,
					invoiceUrl: 'https://example.com/invoice/12345',
				});
			});

			it('should parse PAYMENT_RECEIVED event correctly', () => {
				const payload = createValidPayload({ event: 'PAYMENT_RECEIVED' });
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_12345');
				expect(result?.currentStatus).toBe(EPaymentStatus.Paid);
				expect(result?.rawStatus).toBe('CONFIRMED');
				expect(result?.rawEventType).toBe('PAYMENT_RECEIVED');
				expect(result?.metadata).toMatchObject({
					billingType: 'BOLETO',
					netValue: 97.5,
					invoiceUrl: 'https://example.com/invoice/12345',
				});
			});

			it('should parse PAYMENT_OVERDUE event correctly', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_OVERDUE',
					payment: {
						id: 'pay_overdue',
						status: 'OVERDUE',
						billingType: 'BOLETO',
						value: 50.0,
						netValue: 50.0,
						invoiceUrl: 'https://example.com/invoice/overdue',
						bankSlipUrl: 'https://example.com/boleto/overdue',
					},
				});
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_overdue');
				expect(result?.currentStatus).toBe(EPaymentStatus.Expired);
				expect(result?.rawStatus).toBe('OVERDUE');
				expect(result?.rawEventType).toBe('PAYMENT_OVERDUE');
				expect(result?.metadata).toMatchObject({
					billingType: 'BOLETO',
					netValue: 50.0,
					invoiceUrl: 'https://example.com/invoice/overdue',
				});
			});

			it('should parse PAYMENT_REFUNDED event correctly', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_refund',
					event: 'PAYMENT_REFUNDED',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: {
						id: 'pay_refunded',
						status: 'REFUNDED',
						billingType: 'CREDIT_CARD',
						value: 200.0,
						netValue: 190.0,
						invoiceUrl: 'https://example.com/invoice/refunded',
						creditCard: {
							creditCardNumber: '****5678',
							creditCardBrand: 'MASTERCARD',
						},
					},
				};
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_refunded');
				expect(result?.currentStatus).toBe(EPaymentStatus.Refunded);
				expect(result?.rawStatus).toBe('REFUNDED');
				expect(result?.rawEventType).toBe('PAYMENT_REFUNDED');
				expect(result?.metadata).toMatchObject({
					billingType: 'CREDIT_CARD',
					value: 200.0,
					netValue: 190.0,
					invoiceUrl: 'https://example.com/invoice/refunded',
				});
			});

			it('should parse PAYMENT_DELETED event correctly', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_deleted',
					event: 'PAYMENT_DELETED',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: {
						id: 'pay_deleted',
						status: 'DELETED',
						billingType: 'PIX',
						value: 75.0,
						netValue: 75.0,
						invoiceUrl: 'https://example.com/invoice/deleted',
					},
				};
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_deleted');
				expect(result?.currentStatus).toBe(EPaymentStatus.Cancelled);
				expect(result?.rawStatus).toBe('DELETED');
				expect(result?.rawEventType).toBe('PAYMENT_DELETED');
				expect(result?.metadata).toMatchObject({
					billingType: 'PIX',
					invoiceUrl: 'https://example.com/invoice/deleted',
				});
			});

			it('should parse PAYMENT_CHARGEBACK_REQUESTED event correctly', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_CHARGEBACK_REQUESTED',
				});
				const result = sut.parse(payload);

				expect(result).not.toBeNull();
				expect(result?.rawEventType).toBe('PAYMENT_CHARGEBACK_REQUESTED');
				expect(result?.currentStatus).toBe(EPaymentStatus.Chargeback);
			});

			it('should parse PAYMENT_RECEIVED_IN_CASH_UNDONE event correctly', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_cash_undone',
					event: 'PAYMENT_RECEIVED_IN_CASH_UNDONE',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: {
						id: 'pay_cash_undone',
						status: 'PENDING',
						billingType: 'BOLETO',
						value: 150.0,
						netValue: 147.5,
						invoiceUrl: 'https://example.com/invoice/cash_undone',
						bankSlipUrl: 'https://example.com/boleto/cash_undone',
					},
				};
				const result = sut.parse(payload);

				expect(result?.externalId).toBe('pay_cash_undone');
				expect(result?.currentStatus).toBe(EPaymentStatus.Pending);
				expect(result?.rawStatus).toBe('PENDING');
				expect(result?.rawEventType).toBe('PAYMENT_RECEIVED_IN_CASH_UNDONE');
				expect(result?.metadata).toMatchObject({
					billingType: 'BOLETO',
					value: 150.0,
					netValue: 147.5,
					invoiceUrl: 'https://example.com/invoice/cash_undone',
				});
			});
		});

		describe('metadata extraction', () => {
			it('should extract payment method from billingType', () => {
				const payload = createValidPayload({
					payment: { billingType: 'PIX' } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['billingType']).toBe('PIX');
			});

			it('should extract netValue correctly', () => {
				const payload = createValidPayload({
					payment: { netValue: 123.45 } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['netValue']).toBe(123.45);
			});

			it('should extract invoiceUrl correctly', () => {
				const payload = createValidPayload({
					payment: {
						invoiceUrl: 'https://custom.com/invoice/xyz',
					} as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['invoiceUrl']).toBe(
					'https://custom.com/invoice/xyz',
				);
			});

			it('should include bankSlipUrl when present', () => {
				const payload = createValidPayload({
					payment: {
						bankSlipUrl: 'https://example.com/boleto/abc',
					} as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['bankSlipUrl']).toBe(
					'https://example.com/boleto/abc',
				);
			});

			it('should include creditCard details when present', () => {
				const payload = createValidPayload({
					payment: {
						billingType: 'CREDIT_CARD',
						creditCard: {
							creditCardNumber: '****1234',
							creditCardBrand: 'VISA',
						},
					} as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['creditCard']).toEqual({
					creditCardNumber: '****1234',
					creditCardBrand: 'VISA',
				});
			});

			it('should handle missing optional fields (bankSlipUrl, creditCard)', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_minimal',
					event: 'PAYMENT_CONFIRMED',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: {
						id: 'pay_minimal',
						status: 'CONFIRMED',
						billingType: 'PIX',
						value: 100.0,
						netValue: 100.0,
						invoiceUrl: 'https://example.com/invoice',
					},
				};
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata).toMatchObject({
					billingType: 'PIX',
					netValue: 100.0,
					invoiceUrl: 'https://example.com/invoice',
				});
			});
		});

		describe('status mapping', () => {
			it('should map PAYMENT_CONFIRMED to Paid', () => {
				const payload = createValidPayload({ event: 'PAYMENT_CONFIRMED' });
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Paid);
			});

			it('should map PAYMENT_RECEIVED to Paid', () => {
				const payload = createValidPayload({ event: 'PAYMENT_RECEIVED' });
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Paid);
			});

			it('should map PAYMENT_OVERDUE to Expired', () => {
				const payload = createValidPayload({ event: 'PAYMENT_OVERDUE' });
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Expired);
			});

			it('should map PAYMENT_REFUNDED to Refunded', () => {
				const payload = createValidPayload({ event: 'PAYMENT_REFUNDED' });
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Refunded);
			});

			it('should map PAYMENT_DELETED to Cancelled', () => {
				const payload = createValidPayload({ event: 'PAYMENT_DELETED' });
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Cancelled);
			});

			it('should map PAYMENT_CHARGEBACK_REQUESTED to Chargeback', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_CHARGEBACK_REQUESTED',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Chargeback);
			});

			it('should map PAYMENT_RECEIVED_IN_CASH_UNDONE to Pending', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_RECEIVED_IN_CASH_UNDONE',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.currentStatus).toBe(EPaymentStatus.Pending);
			});
		});

		describe('ignored events', () => {
			it('should return null for unsupported event types', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_CREATED' as any,
				});
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});

			it('should return null for customer-related events', () => {
				const payload = createValidPayload({
					event: 'CUSTOMER_CREATED' as any,
				});
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});

			it('should return null when event type is missing', () => {
				const payload = createValidPayload({
					event: undefined as any,
				});
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});

			it('should return null when event type is empty string', () => {
				const payload = createValidPayload({
					event: '' as any,
				});
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});

			it('should return null when payment object is missing', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_missing',
					event: 'PAYMENT_CONFIRMED',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: undefined as any,
				};
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});

			it('should return null when payment object is null', () => {
				const payload: AsaasWebhookPayload = {
					id: 'evt_null',
					event: 'PAYMENT_CONFIRMED',
					dateCreated: '2024-01-01T12:00:00.000Z',
					payment: null as any,
				};
				const result = sut.parse(payload);

				expect(result).toBeNull();
			});
		});

		describe('edge cases', () => {
			it('should extract externalId from payment.id', () => {
				const payload = createValidPayload({
					payment: { id: 'custom-payment-id-xyz' } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.externalId).toBe('custom-payment-id-xyz');
			});

			it('should preserve original rawEventType', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_RECEIVED',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.rawEventType).toBe('PAYMENT_RECEIVED');
			});

			it('should handle payment with zero netValue', () => {
				const payload = createValidPayload({
					payment: { netValue: 0 } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['netValue']).toBe(0);
			});

			it('should handle payment with negative netValue (refunds)', () => {
				const payload = createValidPayload({
					event: 'PAYMENT_REFUNDED',
					payment: { netValue: -50.0 } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['netValue']).toBe(-50.0);
			});

			it('should handle very long payment IDs', () => {
				const longId = 'pay_' + 'a'.repeat(200);
				const payload = createValidPayload({
					payment: { id: longId } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.externalId).toBe(longId);
			});

			it('should handle special characters in URLs', () => {
				const urlWithParams =
					'https://example.com/invoice?id=123&token=abc&redirect=https://other.com';
				const payload = createValidPayload({
					payment: { invoiceUrl: urlWithParams } as any,
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;

				expect(result.metadata!['invoiceUrl']).toBe(urlWithParams);
			});

			it('should handle different credit card brands', () => {
				const brands = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD'];

				brands.forEach((brand) => {
					const payload = createValidPayload({
						payment: {
							billingType: 'CREDIT_CARD',
							creditCard: {
								creditCardNumber: '****9999',
								creditCardBrand: brand,
							},
						} as any,
					});
					const result = sut.parse(payload) as NormalizedWebhookEvent;

					expect(
						(result.metadata!['creditCard'] as any)['creditCardBrand'],
					).toBe(brand);
				});
			});

			it('should handle multiple payment methods', () => {
				const methods = ['BOLETO', 'CREDIT_CARD', 'PIX', 'DEBIT_CARD'];

				methods.forEach((method) => {
					const payload = createValidPayload({
						payment: { billingType: method } as any,
					});
					const result = sut.parse(payload) as NormalizedWebhookEvent;

					expect(result.metadata!['billingType']).toBe(method);
				});
			});

			it('should handle externalReference field', () => {
				const payload = createValidPayload({
					payment: {
						externalReference: 'order-xyz-123',
					} as any,
				});
				const result = sut.parse(payload);

				expect(result).not.toBeNull();
				expect(result?.externalId).toBe('pay_12345');
			});

			it('should handle all supported events in sequence', () => {
				const supportedEvents = [
					'PAYMENT_CONFIRMED',
					'PAYMENT_RECEIVED',
					'PAYMENT_OVERDUE',
					'PAYMENT_REFUNDED',
					'PAYMENT_DELETED',
					'PAYMENT_CHARGEBACK_REQUESTED',
					'PAYMENT_RECEIVED_IN_CASH_UNDONE',
				];

				supportedEvents.forEach((event) => {
					const payload = createValidPayload({ event: event as any });
					const result = sut.parse(payload);

					expect(result).not.toBeNull();
					expect(result?.rawEventType).toBe(event);
				});
			});
		});
	});
});
