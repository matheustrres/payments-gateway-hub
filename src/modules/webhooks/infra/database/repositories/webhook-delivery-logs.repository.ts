import { Injectable } from '@nestjs/common';

import { WebhookDeliveryLogMapper } from '../mappers/webhook-delivery-log.mapper';

import { WebhookDeliveryLogEntity } from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';
import {
	DeleteManyOptions,
	IWebhookDeliveryLogsRepository,
} from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlWebhookDeliveryLogsRepository implements IWebhookDeliveryLogsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.webhookDeliveryLog.delete({
			where: { id },
		});
	}

	async deleteMany(options?: DeleteManyOptions): Promise<number> {
		const records = await this.dbService.webhookDeliveryLog.findMany({
			where: {
				success: options?.success,
				createdAt: { lt: options?.createdAtThreshold },
			},
			select: { id: true },
			take: options?.limit,
		});
		if (!records.length) return 0;
		const ids = records.map((r) => r.id);
		const { count } = await this.dbService.webhookDeliveryLog.deleteMany({
			where: {
				id: { in: ids },
			},
		});
		return count;
	}

	async findAll(): Promise<WebhookDeliveryLogEntity[]> {
		const records = await this.dbService.webhookDeliveryLog.findMany({
			orderBy: {
				createdAt: 'desc',
			},
		});
		if (!records.length) return [];
		return records.map(WebhookDeliveryLogMapper.toDomain);
	}

	async findById(id: string): Promise<WebhookDeliveryLogEntity | null> {
		const record = await this.dbService.webhookDeliveryLog.findUnique({
			where: { id },
		});
		if (!record) return null;
		return WebhookDeliveryLogMapper.toDomain(record);
	}

	async findManyByTransactionId(
		transactionId: string,
	): Promise<WebhookDeliveryLogEntity[]> {
		const records = await this.dbService.webhookDeliveryLog.findMany({
			where: { transactionId },
			orderBy: {
				createdAt: 'desc',
			},
		});
		return records.map(WebhookDeliveryLogMapper.toDomain);
	}

	async findManyByProjectId(
		projectId: string,
		limit = 100,
	): Promise<WebhookDeliveryLogEntity[]> {
		const records = await this.dbService.webhookDeliveryLog.findMany({
			where: { projectId },
			take: limit,
			orderBy: {
				createdAt: 'desc',
			},
		});
		return records.map(WebhookDeliveryLogMapper.toDomain);
	}

	async insertOne(entity: WebhookDeliveryLogEntity): Promise<void> {
		const record = WebhookDeliveryLogMapper.toPersistence(entity);
		await this.dbService.webhookDeliveryLog.create({
			data: {
				...record,
				payload: JSON.parse(record.payload as string),
			},
		});
	}

	async updateOne(entity: WebhookDeliveryLogEntity): Promise<void> {
		const record = WebhookDeliveryLogMapper.toPersistence(entity);
		await this.dbService.webhookDeliveryLog.update({
			where: { id: record.id },
			data: {
				...record,
				payload: JSON.parse(record.payload as string),
			},
		});
	}
}
