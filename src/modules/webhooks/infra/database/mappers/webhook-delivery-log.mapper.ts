import { WebhookDeliveryLog } from '@prisma/client';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { PaymentMetadata } from '@/core/types';

import { WebhookDeliveryLogEntity } from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';

export class WebhookDeliveryLogMapper {
	static toDomain(raw: WebhookDeliveryLog): WebhookDeliveryLogEntity {
		return WebhookDeliveryLogEntity.createFrom(
			raw.id,
			{
				transactionId: EntityCuid.createFrom(raw.transactionId),
				projectId: EntityCuid.createFrom(raw.projectId),
				eventType: raw.eventType,
				url: raw.url,
				payload: raw.payload as PaymentMetadata,
				statusCode: raw.statusCode,
				responseBody: raw.responseBody,
				errorMessage: raw.errorMessage,
				durationInMs: raw.durationInMs,
				success: raw.success,
			},
			{
				createdAt: raw.createdAt,
			},
		);
	}

	static toPersistence(entity: WebhookDeliveryLogEntity): WebhookDeliveryLog {
		return entity.toSummary();
	}
}
