import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';

import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';

import { WebhookEventEntityBuilder } from '#/data/builders/entities/webhook-event.entity.builder';

describe(WebhookEventEntity.name, () => {
	describe('.createNew', () => {
		it('should create a new webhook event entity', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.id).toBeInstanceOf(EntityCuid);
			expect(webhookEvent.provider).toBe(EPaymentProvider.AbacatePay);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
		});

		it('should create a webhook event with all required properties', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.provider).toBe(EPaymentProvider.AbacatePay);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
			expect(webhookEvent.transactionId).toBe('transaction-id-123');
			expect(webhookEvent.errorMessage).toBeNull();
			expect(webhookEvent.receivedAt).toBeInstanceOf(Date);
			expect(webhookEvent.processedAt).toBeNull();
		});

		it('should create a webhook event without optional headers', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withHeaders(null)
				.build();
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
		});

		it('should create a webhook event without optional transactionId', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(null)
				.build();
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.transactionId).toBeNull();
		});

		it('should create a webhook event without optional errorMessage', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withErrorMessage(null)
				.build();
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.errorMessage).toBeNull();
		});

		it('should create a webhook event without optional processedAt', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withProcessedAt(null)
				.build();
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.processedAt).toBeNull();
		});
	});

	describe('.createFrom', () => {
		it('should create a webhook event entity from existing data', () => {
			const webhookEvent = WebhookEventEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookEventEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(webhookEvent.createdAt.toISOString()).toBe(
				'2024-01-01T00:00:00.000Z',
			);
		});

		it('should create a webhook event entity with meta', () => {
			const webhookEvent = WebhookEventEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookEventEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			expect(webhookEvent).toBeInstanceOf(WebhookEventEntity);
			expect(webhookEvent.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(webhookEvent.createdAt).toBeInstanceOf(Date);
		});
	});

	describe('getters', () => {
		it('should return provider through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.provider).toBe(EPaymentProvider.AbacatePay);
		});

		it('should return transactionId through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.transactionId).toBe('transaction-id-123');
		});

		it('should return status through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
		});

		it('should return errorMessage through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.errorMessage).toBeNull();
		});

		it('should return receivedAt through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.receivedAt).toBeInstanceOf(Date);
			expect(webhookEvent.receivedAt.toISOString()).toBe(
				'2024-01-01T00:00:00.000Z',
			);
		});

		it('should return processedAt through getter', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.processedAt).toBeNull();
		});
	});

	describe('.setStatus', () => {
		it('should update webhook event status', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
			expect(webhookEvent.processedAt).toBeNull();
			webhookEvent.setStatus(EWebhookEventStatus.Processed);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Processed);
			expect(webhookEvent.processedAt).not.toBeNull();
			expect(webhookEvent.processedAt).toBeInstanceOf(Date);
		});

		it('should update processedAt timestamp when status changes', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const initialProcessedAt = webhookEvent.processedAt;
			webhookEvent.setStatus(EWebhookEventStatus.Processed);
			expect(webhookEvent.processedAt).not.toBe(initialProcessedAt);
			expect(webhookEvent.processedAt).toBeInstanceOf(Date);
		});

		it('should handle status change to Failed', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			webhookEvent.setStatus(EWebhookEventStatus.Failed);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Failed);
			expect(webhookEvent.processedAt).not.toBeNull();
		});

		it('should handle status change to Ignored', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			webhookEvent.setStatus(EWebhookEventStatus.Ignored);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Ignored);
			expect(webhookEvent.processedAt).not.toBeNull();
		});
	});

	describe('.setTransactionId', () => {
		it('should update transactionId', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(null)
				.build();
			expect(webhookEvent.transactionId).toBeNull();
			expect(webhookEvent.processedAt).toBeNull();
			webhookEvent.setTransactionId('new-transaction-id-456');
			expect(webhookEvent.transactionId).toBe('new-transaction-id-456');
			expect(webhookEvent.processedAt).not.toBeNull();
		});

		it('should update processedAt timestamp when transactionId changes', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(null)
				.build();
			const initialProcessedAt = webhookEvent.processedAt;
			webhookEvent.setTransactionId('updated-transaction-id');
			expect(webhookEvent.processedAt).not.toBe(initialProcessedAt);
			expect(webhookEvent.processedAt).toBeInstanceOf(Date);
		});

		it('should allow updating existing transactionId', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.transactionId).toBe('transaction-id-123');
			webhookEvent.setTransactionId('new-transaction-id');
			expect(webhookEvent.transactionId).toBe('new-transaction-id');
		});
	});

	describe('.setErrorMessage', () => {
		it('should update errorMessage', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			expect(webhookEvent.errorMessage).toBeNull();
			expect(webhookEvent.processedAt).toBeNull();
			webhookEvent.setErrorMessage('Failed to process webhook');
			expect(webhookEvent.errorMessage).toBe('Failed to process webhook');
			expect(webhookEvent.processedAt).not.toBeNull();
		});

		it('should update processedAt timestamp when errorMessage changes', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const initialProcessedAt = webhookEvent.processedAt;
			webhookEvent.setErrorMessage('Error occurred');
			expect(webhookEvent.processedAt).not.toBe(initialProcessedAt);
			expect(webhookEvent.processedAt).toBeInstanceOf(Date);
		});

		it('should allow updating existing errorMessage', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withErrorMessage('First error')
				.build();
			expect(webhookEvent.errorMessage).toBe('First error');
			webhookEvent.setErrorMessage('Second error');
			expect(webhookEvent.errorMessage).toBe('Second error');
		});
	});

	describe('.toSummary', () => {
		it('should return webhook event summary with all properties', () => {
			const props = new WebhookEventEntityBuilder().buildProps();
			const webhookEvent = WebhookEventEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				props,
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			const summary = webhookEvent.toSummary();
			expect(summary).toEqual({
				id: 'cl9v1x5f20000qzrmn5g6z5v3',
				projectId: props.projectId.toString(),
				provider: EPaymentProvider.AbacatePay,
				payload: JSON.stringify({
					event: 'payment.created',
					data: { id: '123' },
				}),
				headers: JSON.stringify({
					'x-signature': 'abc123',
					'content-type': 'application/json',
				}),
				attempts: 0,
				transactionId: 'transaction-id-123',
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				nextRetryAt: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			});
		});

		it('should stringify payload in summary', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const summary = webhookEvent.toSummary();
			expect(typeof summary.payload).toBe('string');
			expect(summary.payload).toBe(
				JSON.stringify({ event: 'payment.created', data: { id: '123' } }),
			);
		});

		it('should stringify headers in summary when present', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const summary = webhookEvent.toSummary();
			expect(typeof summary.headers).toBe('string');
			expect(summary.headers).toBe(
				JSON.stringify({
					'x-signature': 'abc123',
					'content-type': 'application/json',
				}),
			);
		});

		it('should return null headers in summary when not present', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withHeaders(null)
				.build();
			const summary = webhookEvent.toSummary();
			expect(summary.headers).toBeNull();
		});

		it('should include null processedAt in summary for new webhook event', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const summary = webhookEvent.toSummary();
			expect(summary.processedAt).toBeNull();
		});

		it('should include processedAt in summary after processing', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			webhookEvent.setStatus(EWebhookEventStatus.Processed);
			const summary = webhookEvent.toSummary();
			expect(summary.processedAt).not.toBeNull();
			expect(summary.processedAt).toBeInstanceOf(Date);
		});

		it('should include null transactionId in summary when not present', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(null)
				.build();
			const summary = webhookEvent.toSummary();
			expect(summary.transactionId).toBeNull();
		});

		it('should include null errorMessage in summary when not present', () => {
			const webhookEvent = new WebhookEventEntityBuilder().build();
			const summary = webhookEvent.toSummary();
			expect(summary.errorMessage).toBeNull();
		});
	});

	describe('different webhook scenarios', () => {
		it('should create webhook event with Asaas provider', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withProvider(EPaymentProvider.Asaas)
				.build();
			expect(webhookEvent.provider).toBe(EPaymentProvider.Asaas);
		});

		it('should create webhook event with Payoneer provider', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withProvider(EPaymentProvider.Payoneer)
				.build();
			expect(webhookEvent.provider).toBe(EPaymentProvider.Payoneer);
		});

		it('should create webhook event with Processed status', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Processed)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Processed);
		});

		it('should create webhook event with Failed status', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Failed)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Failed);
		});

		it('should create webhook event with Ignored status', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Ignored)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Ignored);
		});

		it('should create webhook event with custom payload', () => {
			const customPayload = {
				event: 'payment.approved',
				data: { transactionId: 'txn-456', amount: 100 },
			};
			const webhookEvent = new WebhookEventEntityBuilder()
				.withPayload(customPayload)
				.build();
			const summary = webhookEvent.toSummary();
			expect(summary.payload).toBe(JSON.stringify(customPayload));
		});

		it('should create webhook event with custom headers', () => {
			const customHeaders = {
				'x-webhook-id': 'webhook-123',
				'x-timestamp': '1234567890',
			};
			const webhookEvent = new WebhookEventEntityBuilder()
				.withHeaders(customHeaders)
				.build();
			const summary = webhookEvent.toSummary();
			expect(summary.headers).toBe(JSON.stringify(customHeaders));
		});

		it('should create webhook event with error message', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withErrorMessage('Connection timeout')
				.build();
			expect(webhookEvent.errorMessage).toBe('Connection timeout');
		});

		it('should create webhook event with processedAt date', () => {
			const processedDate = new Date('2024-01-02T00:00:00Z');
			const webhookEvent = new WebhookEventEntityBuilder()
				.withProcessedAt(processedDate)
				.build();
			expect(webhookEvent.processedAt).toEqual(processedDate);
		});
	});

	describe('webhook event lifecycle', () => {
		it('should transition from Pending to Processed', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
			expect(webhookEvent.processedAt).toBeNull();
			webhookEvent.setTransactionId('txn-123');
			webhookEvent.setStatus(EWebhookEventStatus.Processed);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Processed);
			expect(webhookEvent.transactionId).toBe('txn-123');
			expect(webhookEvent.processedAt).not.toBeNull();
		});

		it('should transition from Pending to Failed with error message', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
			expect(webhookEvent.errorMessage).toBeNull();
			webhookEvent.setErrorMessage('Invalid signature');
			webhookEvent.setStatus(EWebhookEventStatus.Failed);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Failed);
			expect(webhookEvent.errorMessage).toBe('Invalid signature');
			expect(webhookEvent.processedAt).not.toBeNull();
		});

		it('should transition from Pending to Ignored', () => {
			const webhookEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.build();
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Pending);
			webhookEvent.setStatus(EWebhookEventStatus.Ignored);
			expect(webhookEvent.status).toBe(EWebhookEventStatus.Ignored);
			expect(webhookEvent.processedAt).not.toBeNull();
		});
	});
});
