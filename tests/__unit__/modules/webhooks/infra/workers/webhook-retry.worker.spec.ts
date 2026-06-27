import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { ProcessInboundWebhookUseCase } from '@/modules/webhooks/application/use-cases/process-inbound-webhook/process-inbound-webhook.use-case';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';
import { WebhookRetryWorker } from '@/modules/webhooks/infra/workers/webhook-retry.worker';

import { WebhookEventEntityBuilder } from '#/data/builders/entities/webhook-event.entity.builder';
import { createWebhookEventsRepositoryMock } from '#/data/mocks/repositories/webhook-events.repository';

describe(WebhookRetryWorker.name, () => {
	let sut: WebhookRetryWorker;
	let webhookEventsRepository: IWebhookEventsRepository;
	let processInboundWebhookUseCase: ProcessInboundWebhookUseCase;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-12-22T10:00:00Z'));
		webhookEventsRepository = createWebhookEventsRepositoryMock();
		processInboundWebhookUseCase = {
			exec: vi.fn(),
		} as any;
		sut = new WebhookRetryWorker(
			webhookEventsRepository,
			processInboundWebhookUseCase,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('handle', () => {
		it('should process webhook events with the correct reference time', async () => {
			const now = new Date('2025-12-22T10:00:00Z');
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([]);
			await sut.handleCron();
			expect(webhookEventsRepository.findManyToRetry).toHaveBeenCalledWith(
				now,
				20,
			);
		});

		it('should process webhook events that are ready for retry', async () => {
			const event1 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			const event2 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(2)
				.withNextRetryAt(new Date('2025-01-01T11:50:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event1, event2]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(webhookEventsRepository.findManyToRetry).toHaveBeenCalledWith(
				expect.any(Date),
				20,
			);
			expect(processInboundWebhookUseCase.exec).toHaveBeenCalledTimes(2);
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(1, {
				eventId: event1.id.toString(),
				projectId: event1.projectId.toString(),
				provider: event1.provider,
				payload: event1.payload,
				headers: event1.headers,
			});
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(2, {
				eventId: event2.id.toString(),
				projectId: event2.projectId.toString(),
				provider: event2.provider,
				payload: event2.payload,
				headers: event2.headers,
			});
		});

		it('should not process anything when no events are ready for retry', async () => {
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(webhookEventsRepository.findManyToRetry).toHaveBeenCalledWith(
				expect.any(Date),
				20,
			);
			expect(processInboundWebhookUseCase.exec).not.toHaveBeenCalled();
		});

		it('should continue processing other events if one fails', async () => {
			const event1 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			const event2 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(2)
				.withNextRetryAt(new Date('2025-01-01T11:50:00Z'))
				.build();
			const event3 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:45:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event1, event2, event3]);
			const error = new Error('Processing failed');
			vi.spyOn(processInboundWebhookUseCase, 'exec')
				.mockResolvedValueOnce() // event1 bem sucedido
				.mockRejectedValueOnce(error) // event2 falha
				.mockResolvedValueOnce(); // event3 bem sucedido
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValue();
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(processInboundWebhookUseCase.exec).toHaveBeenCalledTimes(3);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(event2);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/❌ Retry \d+ failed for event/),
			);
			loggerErrorSpy.mockRestore();
		});

		it('should respect the batch size limit', async () => {
			const events = Array.from({ length: 25 }, (_) =>
				new WebhookEventEntityBuilder()
					.withStatus(EWebhookEventStatus.Pending)
					.withAttempts(1)
					.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
					.build(),
			);
			// Repositorio retorna 20 eventos (BATCH_SIZE)
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce(events.slice(0, 20));
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(webhookEventsRepository.findManyToRetry).toHaveBeenCalledWith(
				expect.any(Date),
				20,
			);
			expect(processInboundWebhookUseCase.exec).toHaveBeenCalledTimes(20);
		});

		it('should log message when starting the worker', async () => {
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([]);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Starting webhook retry worker...',
			);
			loggerLogSpy.mockRestore();
		});

		it('should log message with count when events are found', async () => {
			const events = Array.from({ length: 3 }, () =>
				new WebhookEventEntityBuilder()
					.withStatus(EWebhookEventStatus.Pending)
					.withAttempts(1)
					.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
					.build(),
			);
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce(events);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Processing batch of 3 retry events.',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Webhook retry batch finished.',
			);
			loggerLogSpy.mockRestore();
		});

		it('should log message for each successfully retried event', async () => {
			const event = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/✅ Event .+ retried successfully\./),
			);
			loggerLogSpy.mockRestore();
		});

		it('should handle events from different providers', async () => {
			const abacatePayEvent = new WebhookEventEntityBuilder()
				.withProvider(EPaymentProvider.AbacatePay)
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			const asaasEvent = new WebhookEventEntityBuilder()
				.withProvider(EPaymentProvider.Asaas)
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:50:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([abacatePayEvent, asaasEvent]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(1, {
				eventId: abacatePayEvent.id.toString(),
				projectId: abacatePayEvent.projectId.toString(),
				provider: EPaymentProvider.AbacatePay,
				payload: abacatePayEvent.payload,
				headers: abacatePayEvent.headers,
			});
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(2, {
				eventId: asaasEvent.id.toString(),
				projectId: asaasEvent.projectId.toString(),
				provider: EPaymentProvider.Asaas,
				payload: asaasEvent.payload,
				headers: asaasEvent.headers,
			});
		});

		it('should handle events with different attempt counts', async () => {
			const firstAttemptEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			const thirdAttemptEvent = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(3)
				.withNextRetryAt(new Date('2025-01-01T11:50:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([firstAttemptEvent, thirdAttemptEvent]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(processInboundWebhookUseCase.exec).toHaveBeenCalledTimes(2);
		});

		it('should pass correct headers including null values', async () => {
			const eventWithHeaders = new WebhookEventEntityBuilder()
				.withHeaders({ 'x-signature': 'abc123' })
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			const eventWithoutHeaders = new WebhookEventEntityBuilder()
				.withHeaders(null)
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.withNextRetryAt(new Date('2025-01-01T11:50:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([eventWithHeaders, eventWithoutHeaders]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			await sut.handleCron();
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(1, {
				eventId: eventWithHeaders.id.toString(),
				projectId: eventWithHeaders.projectId.toString(),
				provider: eventWithHeaders.provider,
				payload: eventWithHeaders.payload,
				headers: { 'x-signature': 'abc123' },
			});
			expect(processInboundWebhookUseCase.exec).toHaveBeenNthCalledWith(2, {
				eventId: eventWithoutHeaders.id.toString(),
				projectId: eventWithoutHeaders.projectId.toString(),
				provider: eventWithoutHeaders.provider,
				payload: eventWithoutHeaders.payload,
				headers: null,
			});
		});

		it('should call markAsFailed with MAX_ATTEMPTS when retry fails', async () => {
			const event = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(3)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event]);
			const error = new Error('Network timeout');
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockRejectedValueOnce(
				error,
			);
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValue();
			const markAsFailedSpy = vi.spyOn(event, 'markAsFailed');
			vi.spyOn(sut['logger'], 'error').mockImplementation(() => {});
			await sut.handleCron();
			expect(markAsFailedSpy).toHaveBeenCalledWith('Network timeout', 6);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(event);
		});

		it('should update event in repository after marking as failed', async () => {
			const event = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(2)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockRejectedValueOnce(
				new Error('Database error'),
			);
			const updateOneSpy = vi
				.spyOn(webhookEventsRepository, 'updateOne')
				.mockResolvedValue();
			vi.spyOn(sut['logger'], 'error').mockImplementation(() => {});
			await sut.handleCron();
			expect(updateOneSpy).toHaveBeenCalledTimes(1);
			expect(updateOneSpy).toHaveBeenCalledWith(event);
		});

		it('should log error with attempt count and next retry time on failure', async () => {
			const event = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(2)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockRejectedValueOnce(
				new Error('Timeout'),
			);
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValue();
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/❌ Retry \d+ failed for event .+\. Next:/),
			);
		});

		it('should log PERMANENT_FAILURE when event exceeds MAX_ATTEMPTS', async () => {
			const event = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(5)
				.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event]);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockRejectedValueOnce(
				new Error('Final failure'),
			);
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValue();
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.handleCron();
			// After markAsFailed is called with attempts=5, it becomes 6, which equals MAX_ATTEMPTS
			// This should set nextRetryAt to null, resulting in PERMANENT_FAILURE log
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/PERMANENT_FAILURE/),
			);
		});

		it('should process events in parallel using Promise.allSettled', async () => {
			const events = Array.from({ length: 5 }, () =>
				new WebhookEventEntityBuilder()
					.withStatus(EWebhookEventStatus.Pending)
					.withAttempts(1)
					.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
					.build(),
			);
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce(events);
			const execSpy = vi
				.spyOn(processInboundWebhookUseCase, 'exec')
				.mockResolvedValue();
			await sut.handleCron();
			// All events should be processed
			expect(execSpy).toHaveBeenCalledTimes(5);
		});

		it('should handle mixed success and failure results from Promise.allSettled', async () => {
			const event1 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.build();
			const event2 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(2)
				.build();
			const event3 = new WebhookEventEntityBuilder()
				.withStatus(EWebhookEventStatus.Pending)
				.withAttempts(1)
				.build();
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce([event1, event2, event3]);
			vi.spyOn(processInboundWebhookUseCase, 'exec')
				.mockResolvedValueOnce() // success
				.mockRejectedValueOnce(new Error('Failed')) // failure
				.mockResolvedValueOnce(); // success
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValue();
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.handleCron();
			// Should log success for event1 and event3
			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/✅ Event .+ retried successfully\./),
			);
			// Should log error for event2
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringMatching(/❌ Retry \d+ failed for event/),
			);
			// Should update only the failed event
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledTimes(1);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(event2);
		});

		it('should log batch finished message after processing all events', async () => {
			const events = Array.from({ length: 2 }, () =>
				new WebhookEventEntityBuilder()
					.withStatus(EWebhookEventStatus.Pending)
					.withAttempts(1)
					.withNextRetryAt(new Date('2025-01-01T11:55:00Z'))
					.build(),
			);
			vi.spyOn(
				webhookEventsRepository,
				'findManyToRetry',
			).mockResolvedValueOnce(events);
			vi.spyOn(processInboundWebhookUseCase, 'exec').mockResolvedValue();
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Webhook retry batch finished.',
			);
		});
	});
});
