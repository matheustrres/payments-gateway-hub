import { WebhookDeliveryLogEntityBuilder } from '../../../../../data/builders/entities/webhook-delivery-log.entity.builder';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';

import { WebhookDeliveryLogEntity } from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';

describe(WebhookDeliveryLogEntity.name, () => {
	describe('.createNew', () => {
		it('should create a new webhook delivery log entity', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.id).toBeInstanceOf(EntityCuid);
			expect(log.transactionId).toBeInstanceOf(EntityId);
			expect(log.projectId).toBeInstanceOf(EntityId);
			expect(log.eventType).toBe('payment.paid');
		});

		it('should create a webhook delivery log with all required properties', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.transactionId.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(log.projectId.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v4');
			expect(log.eventType).toBe('payment.paid');
			expect(log.url).toBe('https://example.com/webhook');
			expect(log.payload).toEqual({
				transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
				status: 'paid',
				amount: 10000,
			});
			expect(log.statusCode).toBe(200);
			expect(log.responseBody).toBe('{"success":true}');
			expect(log.errorMessage).toBeNull();
			expect(log.durationInMs).toBe(150);
			expect(log.success).toBe(true);
		});

		it('should create a webhook delivery log without optional statusCode', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.build();
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.statusCode).toBeNull();
		});

		it('should create a webhook delivery log without optional responseBody', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withResponseBody(null)
				.build();
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.responseBody).toBeNull();
		});

		it('should create a webhook delivery log without optional errorMessage', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withErrorMessage(null)
				.build();
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.errorMessage).toBeNull();
		});

		it('should create a webhook delivery log with all optional fields as null', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.withResponseBody(null)
				.withErrorMessage(null)
				.build();
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.statusCode).toBeNull();
			expect(log.responseBody).toBeNull();
			expect(log.errorMessage).toBeNull();
		});
	});

	describe('.createFrom', () => {
		it('should create a webhook delivery log entity from existing data', () => {
			const log = WebhookDeliveryLogEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookDeliveryLogEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(log.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});

		it('should create a webhook delivery log entity with default createdAt', () => {
			const log = WebhookDeliveryLogEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookDeliveryLogEntityBuilder().buildProps(),
				{},
			);
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(log.createdAt).toBeInstanceOf(Date);
		});

		it('should create a webhook delivery log with null optional fields', () => {
			const log = WebhookDeliveryLogEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookDeliveryLogEntityBuilder()
					.withStatusCode(null)
					.withResponseBody(null)
					.withErrorMessage(null)
					.buildProps(),
				{},
			);
			expect(log).toBeInstanceOf(WebhookDeliveryLogEntity);
			expect(log.statusCode).toBeNull();
			expect(log.responseBody).toBeNull();
			expect(log.errorMessage).toBeNull();
		});
	});

	describe('getters', () => {
		it('should return transactionId through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.transactionId).toBeInstanceOf(EntityId);
			expect(log.transactionId.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
		});

		it('should return projectId through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.projectId).toBeInstanceOf(EntityId);
			expect(log.projectId.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v4');
		});

		it('should return eventType through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.eventType).toBe('payment.paid');
		});

		it('should return url through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.url).toBe('https://example.com/webhook');
		});

		it('should return payload through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.payload).toEqual({
				transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
				status: 'paid',
				amount: 10000,
			});
		});

		it('should return statusCode through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.statusCode).toBe(200);
		});

		it('should return null statusCode when not provided', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.build();
			expect(log.statusCode).toBeNull();
		});

		it('should return responseBody through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.responseBody).toBe('{"success":true}');
		});

		it('should return null responseBody when not provided', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withResponseBody(null)
				.build();
			expect(log.responseBody).toBeNull();
		});

		it('should return errorMessage through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withErrorMessage('Connection timeout')
				.build();
			expect(log.errorMessage).toBe('Connection timeout');
		});

		it('should return null errorMessage when not provided', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.errorMessage).toBeNull();
		});

		it('should return durationInMs through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.durationInMs).toBe(150);
		});

		it('should return success through getter', () => {
			const log = new WebhookDeliveryLogEntityBuilder().build();
			expect(log.success).toBe(true);
		});
	});

	describe('.toSummary', () => {
		it('should return webhook delivery log summary with all properties', () => {
			const log = WebhookDeliveryLogEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new WebhookDeliveryLogEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			const summary = log.toSummary();
			expect(summary).toEqual({
				id: 'cl9v1x5f20000qzrmn5g6z5v3',
				transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
				projectId: 'cl9v1x5f20000qzrmn5g6z5v4',
				eventType: 'payment.paid',
				url: 'https://example.com/webhook',
				payload: JSON.stringify({
					transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
					status: 'paid',
					amount: 10000,
				}),
				statusCode: 200,
				responseBody: '{"success":true}',
				errorMessage: null,
				durationInMs: 150,
				success: true,
				createdAt: new Date('2024-01-01T00:00:00Z'),
			});
		});

		it('should stringify payload in summary', () => {
			const payload = {
				transactionId: 'test-123',
				status: 'paid',
				metadata: { key: 'value' },
			};
			const log = new WebhookDeliveryLogEntityBuilder()
				.withPayload(payload)
				.build();
			const summary = log.toSummary();
			expect(summary.payload).toBe(JSON.stringify(payload));
			expect(typeof summary.payload).toBe('string');
		});

		it('should include null statusCode in summary when not present', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.build();
			const summary = log.toSummary();
			expect(summary.statusCode).toBeNull();
		});

		it('should include null responseBody in summary when not present', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withResponseBody(null)
				.build();
			const summary = log.toSummary();
			expect(summary.responseBody).toBeNull();
		});

		it('should include null errorMessage in summary when not present', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withErrorMessage(null)
				.build();
			const summary = log.toSummary();
			expect(summary.errorMessage).toBeNull();
		});

		it('should include all null optional fields in summary', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.withResponseBody(null)
				.withErrorMessage(null)
				.build();
			const summary = log.toSummary();
			expect(summary.statusCode).toBeNull();
			expect(summary.responseBody).toBeNull();
			expect(summary.errorMessage).toBeNull();
		});
	});

	describe('successful delivery scenarios', () => {
		it('should create log for successful payment.paid webhook', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.paid')
				.withStatusCode(200)
				.withSuccess(true)
				.build();
			expect(log.eventType).toBe('payment.paid');
			expect(log.statusCode).toBe(200);
			expect(log.success).toBe(true);
			expect(log.errorMessage).toBeNull();
		});

		it('should create log for successful payment.failed webhook', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.failed')
				.withStatusCode(200)
				.withSuccess(true)
				.build();
			expect(log.eventType).toBe('payment.failed');
			expect(log.statusCode).toBe(200);
			expect(log.success).toBe(true);
		});

		it('should create log for successful payment.refunded webhook', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.refunded')
				.withStatusCode(200)
				.withSuccess(true)
				.build();
			expect(log.eventType).toBe('payment.refunded');
			expect(log.statusCode).toBe(200);
			expect(log.success).toBe(true);
		});

		it('should track fast delivery duration', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withDurationInMs(50)
				.withSuccess(true)
				.build();
			expect(log.durationInMs).toBe(50);
			expect(log.success).toBe(true);
		});

		it('should track slow delivery duration', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withDurationInMs(5000)
				.withSuccess(true)
				.build();
			expect(log.durationInMs).toBe(5000);
			expect(log.success).toBe(true);
		});
	});

	describe('failed delivery scenarios', () => {
		it('should create log for failed delivery with connection timeout', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.withResponseBody(null)
				.withErrorMessage('Connection timeout after 30s')
				.withSuccess(false)
				.build();
			expect(log.statusCode).toBeNull();
			expect(log.responseBody).toBeNull();
			expect(log.errorMessage).toBe('Connection timeout after 30s');
			expect(log.success).toBe(false);
		});

		it('should create log for failed delivery with 500 error', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(500)
				.withResponseBody('{"error":"Internal Server Error"}')
				.withErrorMessage('Server returned 500')
				.withSuccess(false)
				.build();
			expect(log.statusCode).toBe(500);
			expect(log.responseBody).toBe('{"error":"Internal Server Error"}');
			expect(log.errorMessage).toBe('Server returned 500');
			expect(log.success).toBe(false);
		});

		it('should create log for failed delivery with 404 error', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(404)
				.withResponseBody('Not Found')
				.withErrorMessage('Webhook endpoint not found')
				.withSuccess(false)
				.build();
			expect(log.statusCode).toBe(404);
			expect(log.errorMessage).toBe('Webhook endpoint not found');
			expect(log.success).toBe(false);
		});

		it('should create log for failed delivery with network error', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withStatusCode(null)
				.withResponseBody(null)
				.withErrorMessage('ECONNREFUSED')
				.withSuccess(false)
				.build();
			expect(log.statusCode).toBeNull();
			expect(log.responseBody).toBeNull();
			expect(log.errorMessage).toBe('ECONNREFUSED');
			expect(log.success).toBe(false);
		});
	});

	describe('different event types', () => {
		it('should create log for payment.pending event', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.pending')
				.build();
			expect(log.eventType).toBe('payment.pending');
		});

		it('should create log for payment.cancelled event', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.cancelled')
				.build();
			expect(log.eventType).toBe('payment.cancelled');
		});

		it('should create log for payment.expired event', () => {
			const log = new WebhookDeliveryLogEntityBuilder()
				.withEventType('payment.expired')
				.build();
			expect(log.eventType).toBe('payment.expired');
		});
	});
});
