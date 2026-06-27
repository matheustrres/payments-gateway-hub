import { WebhookEvent } from '@prisma/client';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';

export class WebhookEventMapper {
	static toDomain(raw: WebhookEvent): WebhookEventEntity {
		return WebhookEventEntity.createFrom(
			raw.id,
			{
				projectId: EntityCuid.createFrom(raw.projectId),
				provider: raw.provider as EPaymentProvider,
				payload: raw.payload as PaymentMetadata,
				headers: raw.headers ? (raw.headers as PaymentMetadata) : null,
				transactionId: raw.transactionId,
				status: raw.status as EWebhookEventStatus,
				errorMessage: raw.errorMessage,
				receivedAt: raw.receivedAt,
				externalEventId: raw.externalEventId,
				processedAt: raw.processedAt,
				attempts: raw.attempts,
				nextRetryAt: raw.nextRetryAt,
			},
			{
				createdAt: raw.receivedAt,
			},
		);
	}

	static toPersistence(entity: WebhookEventEntity): WebhookEvent {
		return entity.toSummary();
	}
}
