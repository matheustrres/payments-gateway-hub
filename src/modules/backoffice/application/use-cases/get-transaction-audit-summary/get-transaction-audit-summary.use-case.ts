import { Injectable, NotFoundException } from '@nestjs/common';

import {
	GetTransactionAuditSummaryUseCaseInput,
	GetTransactionAuditSummaryUseCaseOutput,
} from '../dtos/transaction-audit-summary';

import { IUseCase } from '@/core/use-case';

import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

import { errorMessages } from '@/shared/utils/err-messages';

const SENSITIVE_HEADERS = [
	'authorization',
	'x-api-key',
	'api-key',
	'access_token',
	'x-access-token',
	'cookie',
	'set-cookie',
	'asaas-access-token',
];

@Injectable()
export class GetTransactionAuditSummaryUseCase implements IUseCase<
	GetTransactionAuditSummaryUseCaseInput,
	GetTransactionAuditSummaryUseCaseOutput
> {
	constructor(
		private readonly transactionsRepository: ITransactionsRepository,
		private readonly transactionHistoriesRepository: ITransactionHistoriesRepository,
		private readonly webhookEventsRepository: IWebhookEventsRepository,
		private readonly webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository,
	) {}

	async exec(
		input: GetTransactionAuditSummaryUseCaseInput,
	): Promise<GetTransactionAuditSummaryUseCaseOutput> {
		const transaction = await this.findTransaction(input);
		if (!transaction) {
			throw new NotFoundException(errorMessages.transactions.notFound);
		}
		const transactionId = transaction.id.toString();
		const [webhookEvent, transactionHistories, deliveryLogs] =
			await Promise.all([
				this.webhookEventsRepository.findByTransactionId(transactionId),
				this.transactionHistoriesRepository.findManyByTransactionId(
					transactionId,
				),
				this.webhookDeliveryLogsRepository.findManyByTransactionId(
					transactionId,
				),
			]);
		const output: GetTransactionAuditSummaryUseCaseOutput = {
			transaction: {
				id: transactionId,
				externalId: transaction.externalId || '',
				status: transaction.status,
				amountInCents: Number(transaction.amountInCents.value),
				createdAt: transaction.createdAt,
			},
			inbound: webhookEvent
				? {
						provider: webhookEvent.provider,
						status: webhookEvent.status,
						payload: webhookEvent.payload,
						headers: this.sanitizeHeaders(webhookEvent.headers),
						attempts: webhookEvent.attempts,
						nextRetryAt: webhookEvent.nextRetryAt,
						errorMessage: webhookEvent.errorMessage,
						receivedAt: webhookEvent.receivedAt,
					}
				: null,
			timeline: transactionHistories.map((history) => ({
				from: history.fromStatus,
				to: history.toStatus,
				trigger: history.trigger,
				createdAt: history.createdAt,
			})),
			outbound: this.mapDeliveryLogs(deliveryLogs),
		};
		const oldestHistory = transactionHistories[0];
		if (deliveryLogs.length === 0 && oldestHistory) {
			const daysSinceCreation = this.getDaysSince(oldestHistory.createdAt);
			if (daysSinceCreation > 7) {
				output.retentionNotice =
					'Os logs de entrega de webhook podem ter sido removidos pela política de retenção (sucesso > 7 dias, erro > 30 dias).';
			}
		}
		return output;
	}

	private async findTransaction(
		input: GetTransactionAuditSummaryUseCaseInput,
	): Promise<TransactionEntity | null> {
		return input.transactionId
			? this.transactionsRepository.findById(input.transactionId)
			: input.externalId
				? this.transactionsRepository.findByExternalId(input.externalId)
				: null;
	}

	private sanitizeHeaders(
		headers: Record<string, unknown> | null,
	): Record<string, string> {
		if (!headers) return {};
		const sanitized: Record<string, string> = {};
		for (const [key, value] of Object.entries(headers)) {
			const lowerKey = key.toLowerCase();
			if (SENSITIVE_HEADERS.includes(lowerKey)) {
				sanitized[key] = '[REDACTED]';
			} else {
				sanitized[key] = String(value);
			}
		}
		return sanitized;
	}

	private mapDeliveryLogs(
		logs: Array<{
			url: string;
			success: boolean;
			statusCode: number | null;
			durationInMs: number;
			createdAt: Date;
			errorMessage: string | null;
		}>,
	) {
		const logsByUrl = new Map<
			string,
			Array<{
				success: boolean;
				statusCode: number | null;
				durationInMs: number;
				createdAt: Date;
				errorMessage: string | null;
			}>
		>();
		for (const log of logs) {
			const existing = logsByUrl.get(log.url) || [];
			existing.push(log);
			logsByUrl.set(log.url, existing);
		}
		return Array.from(logsByUrl.entries()).map(([url, urlLogs]) => {
			const sortedLogs = urlLogs.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			);
			const lastLog = sortedLogs[0]!;
			const hasSuccess = urlLogs.some((l) => l.success);
			return {
				url,
				success: hasSuccess,
				statusCode: lastLog.statusCode,
				durationInMs: lastLog.durationInMs,
				attempts: urlLogs.length,
				lastAttemptAt: lastLog.createdAt,
				errorMessage: lastLog.errorMessage || undefined,
			};
		});
	}

	private getDaysSince(date: Date): number {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		return Math.floor(diffMs / (1000 * 60 * 60 * 24));
	}
}
