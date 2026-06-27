import { Inject, Injectable, Logger } from '@nestjs/common';

import {
	ProcessInboundWebhookUseCaseInput,
	ProcessInboundWebhookUseCaseOutput,
} from '../dtos/process-inbound.dto';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';
import { IUseCase } from '@/core/use-case';

import { TransactionHistoryEntity } from '@/modules/payments/domain/entities/transaction-history.entity';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookQueueProducerPort } from '@/modules/webhooks/application/ports/queue-producer.port';
import {
	IWebhookParserPort,
	NormalizedWebhookEvent,
} from '@/modules/webhooks/application/ports/webhook-parser.port';
import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

@Injectable()
export class ProcessInboundWebhookUseCase implements IUseCase<
	ProcessInboundWebhookUseCaseInput,
	ProcessInboundWebhookUseCaseOutput
> {
	private readonly logger = new Logger(ProcessInboundWebhookUseCase.name);
	private readonly MAX_ATTEMPTS = 5;
	private readonly ALLOWED_PAID_TO_PENDING_EVENTS = [
		'PAYMENT_RECEIVED_IN_CASH_UNDONE',
	];

	constructor(
		@Inject('WEBHOOK_PARSERS')
		private readonly webhookParsers: IWebhookParserPort[],
		private readonly webhookEventsRepository: IWebhookEventsRepository,
		private readonly transactionsRepository: ITransactionsRepository,
		@Inject('WEBHOOK_QUEUE_PRODUCERS')
		private readonly queueProducer: IWebhookQueueProducerPort,
		private readonly transactionHistoriesRepository: ITransactionHistoriesRepository,
	) {}

	async exec(input: ProcessInboundWebhookUseCaseInput): Promise<void> {
		const webhookEvent = input.eventId
			? await this.webhookEventsRepository.findById(input.eventId)
			: await this.createInitialEvent(input);
		if (!webhookEvent || webhookEvent.status === EWebhookEventStatus.Processed)
			return;
		try {
			const parser = this.getParserForProvider(input.provider);
			if (!parser) {
				await this.handleUnsupportedProvider(webhookEvent, input.provider);
				return;
			}
			const normalizedEvent = parser.parse(input.payload);
			if (!normalizedEvent) {
				await this.handleIgnoredEvent(webhookEvent);
				return;
			}
			const isDuplicate = await this.checkIdempotency(
				normalizedEvent,
				webhookEvent,
			);
			if (isDuplicate) return;
			await this.processTransactionUpdate(webhookEvent, normalizedEvent);
			await this.finalizeEventAsProcessed(webhookEvent);
		} catch (error) {
			await this.handleSystemError(webhookEvent, error);
		}
	}

	private async createInitialEvent(
		input: ProcessInboundWebhookUseCaseInput,
	): Promise<WebhookEventEntity> {
		const webhookEvent = WebhookEventEntity.createNew({
			projectId: EntityCuid.createFrom(input.projectId),
			payload: input.payload,
			headers: input.headers,
			provider: input.provider,
			status: EWebhookEventStatus.Pending,
			receivedAt: new Date(),
		});
		await this.webhookEventsRepository.insertOne(webhookEvent);
		return webhookEvent;
	}

	private async checkIdempotency(
		normalized: NormalizedWebhookEvent,
		webhookEvent: WebhookEventEntity,
	): Promise<boolean> {
		if (!normalized.providerEventId) return false;
		const alreadyProcessed =
			await this.webhookEventsRepository.findByExternalEventId(
				normalized.provider,
				normalized.providerEventId,
			);
		if (
			alreadyProcessed &&
			alreadyProcessed.id.toString() !== webhookEvent.id.toString()
		) {
			const reason = `Duplicate event from ${normalized.provider}: ${normalized.providerEventId}`;
			this.logger.warn(reason);
			await this.handleIgnoredEvent(webhookEvent, reason);
			return true; // duplicate
		}

		webhookEvent.setExternalEventId(normalized.providerEventId);
		return false; // not duplicate
	}

	private getParserForProvider(
		provider: EPaymentProvider,
	): IWebhookParserPort | undefined {
		return this.webhookParsers.find((p) => p.supports(provider));
	}

	private async processTransactionUpdate(
		webhookEvent: WebhookEventEntity,
		normalizedEvent: NormalizedWebhookEvent,
	): Promise<void> {
		const transaction = await this.findTransaction(
			normalizedEvent,
			webhookEvent,
		);
		if (!transaction) return;
		const oldStatus = transaction.status as EPaymentStatus;
		webhookEvent.setTransactionId(transaction.id.toString());
		const shouldUpdateTransaction = this.shouldUpdateTransaction(
			transaction,
			normalizedEvent,
			webhookEvent,
		);
		if (!shouldUpdateTransaction) return;
		await this.applyTransactionChanges(transaction, normalizedEvent);
		await this.recordTransactionHistory(
			transaction,
			oldStatus,
			normalizedEvent,
			webhookEvent,
		);
		this.logger.log(
			`Transaction ${transaction.id} updated to ${normalizedEvent.currentStatus}`,
		);
		await this.queueProducer.dispatch({
			transactionId: transaction.id.toString(),
			projectId: webhookEvent.projectId.toString(),
			fromStatus: oldStatus,
		});
	}

	private async findTransaction(
		normalized: NormalizedWebhookEvent,
		event: WebhookEventEntity,
	): Promise<TransactionEntity | null> {
		const transaction =
			await this.transactionsRepository.findByExternalIdAndProjectId(
				normalized.externalId,
				event.projectId.toString(),
			);
		if (!transaction) {
			this.logger.warn(
				`Transaction not found for externalId: ${normalized.externalId}`,
			);
			event.setErrorMessage('Transaction not found');
			event.setStatus(EWebhookEventStatus.Ignored);
			await this.webhookEventsRepository.updateOne(event);
		}
		return transaction;
	}

	private shouldUpdateTransaction(
		transaction: TransactionEntity,
		normalized: NormalizedWebhookEvent,
		event: WebhookEventEntity,
	): boolean {
		if (transaction.status === normalized.currentStatus) {
			event.setStatus(EWebhookEventStatus.Processed);
			return false;
		}
		const isRegressiveStatus = this.isRegressiveStatus(
			transaction.status,
			normalized.currentStatus,
			normalized.rawEventType,
		);
		if (isRegressiveStatus) {
			const msg = `Stale webhook: ignored transition from ${transaction.status} to ${normalized.currentStatus}`;
			this.logger.log(msg);
			event.setStatus(EWebhookEventStatus.Processed);
			event.setErrorMessage(msg);
			return false;
		}
		return true;
	}

	private async applyTransactionChanges(
		transaction: TransactionEntity,
		normalized: NormalizedWebhookEvent,
	): Promise<void> {
		if (normalized.metadata) {
			transaction.setPaymentData(normalized.metadata);
		}
		transaction.setStatus(normalized.currentStatus);
		transaction.setExternalStatus(normalized.rawStatus);
		await this.transactionsRepository.updateOne(transaction);
	}

	private async recordTransactionHistory(
		transaction: TransactionEntity,
		oldStatus: EPaymentStatus,
		normalized: NormalizedWebhookEvent,
		event: WebhookEventEntity,
	): Promise<void> {
		const history = TransactionHistoryEntity.createNew({
			transactionId: transaction.id,
			fromStatus: oldStatus,
			toStatus: normalized.currentStatus,
			rawStatus: normalized.rawStatus,
			trigger: 'WEBHOOK',
			triggerId: event.id.toString(),
			metadata: normalized.metadata,
		});
		await this.transactionHistoriesRepository.insertOne(history);
	}

	private isRegressiveStatus(
		current: EPaymentStatus,
		next: EPaymentStatus,
		rawEventType: string,
	): boolean {
		if (current !== EPaymentStatus.Paid) return false;
		if (
			next === EPaymentStatus.Pending &&
			this.ALLOWED_PAID_TO_PENDING_EVENTS.includes(rawEventType)
		) {
			return false;
		}
		return [
			EPaymentStatus.Pending,
			EPaymentStatus.Failed,
			EPaymentStatus.Expired,
		].includes(next);
	}

	private async finalizeEventAsProcessed(
		webhookEvent: WebhookEventEntity,
	): Promise<void> {
		if (webhookEvent.status === EWebhookEventStatus.Pending) {
			webhookEvent.setStatus(EWebhookEventStatus.Processed);
		}
		await this.webhookEventsRepository.updateOne(webhookEvent);
	}

	private async handleUnsupportedProvider(
		webhookEvent: WebhookEventEntity,
		provider: string,
	): Promise<void> {
		this.logger.warn(`No parser found for provider: ${provider}`);
		webhookEvent.setErrorMessage('Unsupported webhook provider');
		webhookEvent.setStatus(EWebhookEventStatus.Failed);
		await this.webhookEventsRepository.updateOne(webhookEvent);
	}

	private async handleIgnoredEvent(
		webhookEvent: WebhookEventEntity,
		reason?: string,
	): Promise<void> {
		// Evento não relevante para o sistema (ex: ping, customer.created)
		webhookEvent.setStatus(EWebhookEventStatus.Ignored);
		if (reason) webhookEvent.setErrorMessage(reason);
		await this.webhookEventsRepository.updateOne(webhookEvent);
	}

	private async handleSystemError(
		webhookEvent: WebhookEventEntity,
		error: unknown,
	): Promise<void> {
		this.logger.error('Error processing inbound webhook', error);
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		webhookEvent.markAsFailed(errorMessage, this.MAX_ATTEMPTS);
		try {
			await this.webhookEventsRepository.updateOne(webhookEvent);
		} catch (persistError) {
			this.logger.error('Failed to persist webhook error state', persistError);
		}
	}
}
