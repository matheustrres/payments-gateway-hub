import { beforeEach, describe, expect, it } from 'vitest';

import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';

import { NormalizedWebhookEvent } from '@/modules/webhooks/application/ports/webhook-parser.port';
import {
	AbacatePayWebhookParser,
	AbacatePayWebhookPayload,
} from '@/modules/webhooks/infra/adapters/parsers/abacate-pay-parser.adapter';

function createValidPayload(
	overrides?: Partial<AbacatePayWebhookPayload>,
): AbacatePayWebhookPayload {
	const defaults = {
		id: 'evt-123',
		event: 'billing.paid',
		data: {
			billing: {
				amount: 10000,
				frequency: 'ONE-TIME',
				id: 'billing-123',
				status: 'PAID',
				couponsUsed: [],
				paidAmount: 10000,
			},
			payment: {
				amount: 10000,
				fee: 300,
				method: 'PIX',
			},
		},
	};

	if (!overrides) return defaults;

	return {
		id: overrides.id ?? defaults.id,
		event: overrides.event ?? defaults.event,
		data: {
			billing: {
				amount: overrides.data?.billing?.amount ?? defaults.data.billing.amount,
				frequency:
					overrides.data?.billing?.frequency ?? defaults.data.billing.frequency,
				id: overrides.data?.billing?.id ?? defaults.data.billing.id,
				status:
					overrides.data?.billing && 'status' in overrides.data.billing
						? overrides.data.billing.status
						: defaults.data.billing.status,
				couponsUsed:
					overrides.data?.billing?.couponsUsed ??
					defaults.data.billing.couponsUsed,
				paidAmount:
					overrides.data?.billing?.paidAmount ??
					defaults.data.billing.paidAmount,
			},
			payment: {
				amount: overrides.data?.payment?.amount ?? defaults.data.payment.amount,
				fee:
					overrides.data?.payment && 'fee' in overrides.data.payment
						? overrides.data.payment.fee
						: defaults.data.payment.fee,
				method: overrides.data?.payment?.method ?? defaults.data.payment.method,
			},
		},
	};
}

describe(AbacatePayWebhookParser.name, () => {
	let sut: AbacatePayWebhookParser;

	beforeEach(() => {
		sut = new AbacatePayWebhookParser();
	});

	describe('.supports', () => {
		it('should return true for AbacatePay provider', () => {
			const result = sut.supports(EPaymentProvider.AbacatePay);
			expect(result).toBe(true);
		});

		it('should return false for Asaas provider', () => {
			const result = sut.supports(EPaymentProvider.Asaas);
			expect(result).toBe(false);
		});

		it('should return false for Payoneer provider', () => {
			const result = sut.supports(EPaymentProvider.Payoneer);
			expect(result).toBe(false);
		});
	});

	describe('.parse', () => {
		describe('successful parsing', () => {
			it('should parse billing.paid event correctly', () => {
				const payload = createValidPayload();
				const result = sut.parse(payload);
				expect(result).toMatchObject({
					externalId: 'billing-123',
					currentStatus: EPaymentStatus.Paid,
					rawStatus: 'PAID',
					rawEventType: 'billing.paid',
					metadata: {
						amount: 10000,
						fee: 300,
						method: 'PIX',
					},
				});
			});

			it('should parse billing.failed event correctly', () => {
				const payload = createValidPayload({
					event: 'billing.failed',
					data: {
						billing: {
							id: 'billing-456',
							amount: 5000,
							frequency: 'one-time',
							status: 'FAILED',
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 5000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload);
				expect(result).toMatchObject({
					externalId: 'billing-456',
					currentStatus: EPaymentStatus.Failed,
					rawStatus: 'FAILED',
					rawEventType: 'billing.failed',
					metadata: {
						amount: 5000,
						fee: 0,
						method: 'PIX',
					},
				});
			});

			it('should parse billing.refunded event correctly', () => {
				const payload = createValidPayload({
					event: 'billing.refunded',
					data: {
						billing: {
							id: 'billing-789',
							amount: 15000,
							frequency: 'one-time',
							status: 'REFUNDED',
							paidAmount: 15000,
							couponsUsed: [],
						},
						payment: {
							amount: 15000,
							fee: 450,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload);
				expect(result).toMatchObject({
					externalId: 'billing-789',
					currentStatus: EPaymentStatus.Refunded,
					rawStatus: 'REFUNDED',
					rawEventType: 'billing.refunded',
					metadata: {
						amount: 15000,
						fee: 450,
						method: 'PIX',
					},
				});
			});

			it('should extract externalId from billing data', () => {
				const payload = createValidPayload();
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.externalId).toBe('billing-123');
			});

			it('should include payment metadata', () => {
				const payload = createValidPayload();
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.metadata).toEqual({
					amount: 10000,
					fee: 300,
					method: 'PIX',
				});
			});

			it('should preserve original event type in rawEventType', () => {
				const payload = createValidPayload({
					event: 'billing.updated',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.rawEventType).toBe('billing.updated');
			});
		});

		describe('status mapping', () => {
			it('should map billing.paid event to Paid status', () => {
				const payload = createValidPayload({
					event: 'billing.paid',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Paid);
			});

			it('should map billing.refunded event to Refunded status', () => {
				const payload = createValidPayload({
					event: 'billing.refunded',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'REFUNDED',
							paidAmount: 10000,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 300,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Refunded);
			});

			it('should map billing.expired event to Expired status', () => {
				const payload = createValidPayload({
					event: 'billing.expired',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'EXPIRED',
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Expired);
			});

			it('should map billing.failed event to Failed status', () => {
				const payload = createValidPayload({
					event: 'billing.failed',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'FAILED',
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Failed);
			});

			it('should map billing.pending event to Pending status', () => {
				const payload = createValidPayload({
					event: 'billing.pending',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'PENDING',
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Pending);
			});

			it('should fallback to billing.status when event type is unknown', () => {
				const payload = createValidPayload({
					event: 'billing.unknown',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'REFUNDED',
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Refunded);
			});

			it('should handle case-insensitive billing.status fallback', () => {
				const payload = createValidPayload({
					event: 'billing.unknown',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'paid',
							paidAmount: 10000,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 300,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Paid);
			});

			it('should fallback to Pending when event is unknown and billing.status is null', () => {
				const payload = createValidPayload({
					event: 'billing.unknown',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: null as any,
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Pending);
			});

			it('should fallback to Pending when event is unknown and billing.status is undefined', () => {
				const payload = createValidPayload({
					event: 'billing.unknown',
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: undefined as any,
							paidAmount: 0,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 0,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.currentStatus).toBe(EPaymentStatus.Pending);
			});
		});

		describe('ignored events', () => {
			it('should return null for non-billing events', () => {
				const payload: AbacatePayWebhookPayload = {
					id: 'evt-123',
					event: 'customer.created',
					data: {
						billing: {} as any,
						payment: {} as any,
					},
				};
				const result = sut.parse(payload);
				expect(result).toBeNull();
			});

			it('should return null for subscription events', () => {
				const payload: AbacatePayWebhookPayload = {
					id: 'evt-123',
					event: 'subscription.created',
					data: {
						billing: {} as any,
						payment: {} as any,
					},
				};
				const result = sut.parse(payload);
				expect(result).toBeNull();
			});

			it('should return null when event type is missing', () => {
				const payload = {
					id: 'evt-123',
					event: undefined as any,
					data: {
						billing: {} as any,
						payment: {} as any,
					},
				};
				const result = sut.parse(payload);
				expect(result).toBeNull();
			});
		});

		describe('edge cases', () => {
			it('should handle billing events with different suffixes', () => {
				const payload = createValidPayload({
					event: 'billing.updated',
				});
				const result = sut.parse(payload);
				expect(result).not.toBeNull();
				expect(result?.rawEventType).toBe('billing.updated');
			});

			it('should handle complex payment metadata', () => {
				const payload = createValidPayload({
					data: {
						billing: {
							id: 'billing-123',
							amount: 10000,
							frequency: 'one-time',
							status: 'PAID',
							paidAmount: 10000,
							couponsUsed: ['COUPON1', 'COUPON2'],
						},
						payment: {
							amount: 9700,
							fee: 300,
							method: 'CREDIT_CARD',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.metadata).toEqual({
					amount: 9700,
					fee: 300,
					method: 'CREDIT_CARD',
				});
			});

			it('should handle billing with zero amounts', () => {
				const payload = createValidPayload({
					data: {
						billing: {
							id: 'billing-free',
							amount: 0,
							frequency: 'one-time',
							status: 'PAID',
							paidAmount: 0,
							couponsUsed: ['FREE100'],
						},
						payment: {
							amount: 0,
							fee: 0,
							method: 'FREE',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.externalId).toBe('billing-free');
				expect(result.currentStatus).toBe(EPaymentStatus.Paid);
			});

			it('should handle very long billing IDs', () => {
				const longId = 'billing-' + 'a'.repeat(100);
				const payload = createValidPayload({
					data: {
						billing: {
							id: longId,
							amount: 10000,
							frequency: 'one-time',
							status: 'PAID',
							paidAmount: 10000,
							couponsUsed: [],
						},
						payment: {
							amount: 10000,
							fee: 300,
							method: 'PIX',
						},
					},
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.externalId).toBe(longId);
			});

			it('should handle special characters in event type', () => {
				const payload = createValidPayload({
					event: 'billing.special-event_v2',
				});
				const result = sut.parse(payload) as NormalizedWebhookEvent;
				expect(result.rawEventType).toBe('billing.special-event_v2');
			});
		});
	});
});
