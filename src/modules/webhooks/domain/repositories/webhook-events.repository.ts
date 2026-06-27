import { WebhookEventEntity } from '../entities/webhook-event.entity';

import { IRepository } from '@/core/domain/repository';
import { EPaymentProvider } from '@/core/enums/payment';

export abstract class IWebhookEventsRepository extends IRepository<WebhookEventEntity> {
	abstract findManyToRetry(
		now: Date,
		limit: number,
	): Promise<WebhookEventEntity[]>;
	abstract findByExternalEventId(
		provider: EPaymentProvider,
		externalEventId: string,
	): Promise<WebhookEventEntity | null>;
	abstract findByTransactionId(
		transactionId: string,
	): Promise<WebhookEventEntity | null>;
}
