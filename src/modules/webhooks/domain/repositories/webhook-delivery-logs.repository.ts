import { WebhookDeliveryLogEntity } from '../entities/webhook-delivery-log.entity';

import { IRepository } from '@/core/domain/repository';

export type DeleteManyOptions = {
	success?: boolean;
	createdAtThreshold?: Date;
	limit?: number;
};

export abstract class IWebhookDeliveryLogsRepository extends IRepository<WebhookDeliveryLogEntity> {
	abstract findManyByTransactionId(
		transactionId: string,
	): Promise<WebhookDeliveryLogEntity[]>;
	abstract findManyByProjectId(
		projectId: string,
		limit?: number,
	): Promise<WebhookDeliveryLogEntity[]>;
	abstract deleteMany(options?: DeleteManyOptions): Promise<number>;
}
