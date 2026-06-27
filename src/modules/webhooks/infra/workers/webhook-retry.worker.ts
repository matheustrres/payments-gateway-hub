import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ProcessInboundWebhookUseCase } from '@/modules/webhooks/application/use-cases/process-inbound-webhook/process-inbound-webhook.use-case';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

@Injectable()
export class WebhookRetryWorker {
	private readonly logger = new Logger(WebhookRetryWorker.name);
	private readonly BATCH_SIZE = 20;
	private readonly MAX_ATTEMPTS = 6;

	constructor(
		private readonly webhookEventsRepository: IWebhookEventsRepository,
		private readonly processInboundWebhookUseCase: ProcessInboundWebhookUseCase,
	) {}

	@Cron(CronExpression.EVERY_MINUTE, {
		name: 'webhook-retry-worker',
		timeZone: 'America/Sao_Paulo',
	})
	async handleCron(): Promise<void> {
		this.logger.log('Starting webhook retry worker...');
		const now = new Date();
		const eventsToRetry = await this.webhookEventsRepository.findManyToRetry(
			now,
			this.BATCH_SIZE,
		);
		if (!eventsToRetry.length) return;
		this.logger.log(
			`Processing batch of ${eventsToRetry.length} retry events.`,
		);
		await Promise.allSettled(
			eventsToRetry.map(async (event) => {
				try {
					await this.processInboundWebhookUseCase.exec({
						eventId: event.id.toString(),
						projectId: event.projectId.toString(),
						provider: event.provider,
						payload: event.payload,
						headers: event.headers,
					});
					this.logger.log(`✅ Event ${event.id} retried successfully.`);
				} catch (error) {
					event.markAsFailed((error as Error).message, this.MAX_ATTEMPTS);
					await this.webhookEventsRepository.updateOne(event);
					this.logger.error(
						`❌ Retry ${event.attempts} failed for event ${event.id}. Next: ${event.nextRetryAt?.toISOString() || 'PERMANENT_FAILURE'}`,
					);
				}
			}),
		);
		this.logger.log('Webhook retry batch finished.');
	}
}
