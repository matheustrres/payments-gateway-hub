import { Injectable } from '@nestjs/common';

import { WebhookEventMapper } from '../mappers/webhook-event.mapper';

import { EPaymentProvider } from '@/core/enums/payment';

import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlWebhookEventsRepository implements IWebhookEventsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.webhookEvent.delete({
			where: { id },
		});
	}

	async findAll(): Promise<WebhookEventEntity[]> {
		const records = await this.dbService.webhookEvent.findMany();
		if (!records.length) return [];
		return records.map(WebhookEventMapper.toDomain);
	}

	async findByExternalEventId(
		provider: EPaymentProvider,
		externalEventId: string,
	): Promise<WebhookEventEntity | null> {
		const record = await this.dbService.webhookEvent.findUnique({
			where: {
				provider_externalEventId: {
					externalEventId,
					provider,
				},
			},
		});
		if (!record) return null;
		return WebhookEventMapper.toDomain(record);
	}

	async findById(id: string): Promise<WebhookEventEntity | null> {
		const record = await this.dbService.webhookEvent.findUnique({
			where: { id },
		});
		if (!record) return null;
		return WebhookEventMapper.toDomain(record);
	}

	async findByTransactionId(
		transactionId: string,
	): Promise<WebhookEventEntity | null> {
		const record = await this.dbService.webhookEvent.findFirst({
			where: { transactionId },
			orderBy: { receivedAt: 'desc' },
		});
		if (!record) return null;
		return WebhookEventMapper.toDomain(record);
	}

	async findManyToRetry(
		now: Date,
		limit: number,
	): Promise<WebhookEventEntity[]> {
		const events = await this.dbService.webhookEvent.findMany({
			where: {
				status: EWebhookEventStatus.Pending,
				attempts: {
					gt: 0, // Apenas eventos que já tiveram pelo menos uma tentativa
					lt: 5,
				},
				nextRetryAt: {
					lte: now,
				},
			},
			take: limit,
			orderBy: {
				nextRetryAt: 'asc',
			},
		});
		return events.map(WebhookEventMapper.toDomain);
	}

	async insertOne(entity: WebhookEventEntity): Promise<void> {
		const record = WebhookEventMapper.toPersistence(entity);
		await this.dbService.webhookEvent.create({
			data: {
				...record,
				payload: JSON.parse(record.payload as string),
				headers: record.headers ? JSON.parse(record.headers as string) : null,
			},
		});
	}

	async updateOne(entity: WebhookEventEntity): Promise<void> {
		const record = WebhookEventMapper.toPersistence(entity);
		await this.dbService.webhookEvent.update({
			where: { id: record.id },
			data: {
				...record,
				payload: JSON.parse(record.payload as string),
				headers: record.headers ? JSON.parse(record.headers as string) : null,
			},
		});
	}
}
