import { NotFoundException } from '@nestjs/common';
import { Mocked } from 'vitest';

import { GetTransactionAuditSummaryUseCase } from '@/modules/backoffice/application/use-cases/get-transaction-audit-summary/get-transaction-audit-summary.use-case';
import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

import { errorMessages } from '@/shared/utils/err-messages';

import { TransactionHistoryEntityBuilder } from '#/data/builders/entities/transaction-history.entity.builder';
import { TransactionEntityBuilder } from '#/data/builders/entities/transaction.entity.builder';
import { WebhookDeliveryLogEntityBuilder } from '#/data/builders/entities/webhook-delivery-log.entity.builder';
import { WebhookEventEntityBuilder } from '#/data/builders/entities/webhook-event.entity.builder';
import { createTransactionHistoriesRepositoryMock } from '#/data/mocks/repositories/transaction-histories.repository';
import { createTransactionsRepositoryMock } from '#/data/mocks/repositories/transactions.repository';
import { createWebhookDeliveryLogsRepositoryMock } from '#/data/mocks/repositories/webhook-delivery-logs.repository';
import { createWebhookEventsRepositoryMock } from '#/data/mocks/repositories/webhook-events.repository';

describe(GetTransactionAuditSummaryUseCase.name, () => {
	let sut: GetTransactionAuditSummaryUseCase;
	let transactionsRepository: Mocked<ITransactionsRepository>;
	let transactionHistoriesRepository: Mocked<ITransactionHistoriesRepository>;
	let webhookEventsRepository: Mocked<IWebhookEventsRepository>;
	let webhookDeliveryLogsRepository: Mocked<IWebhookDeliveryLogsRepository>;

	beforeEach(() => {
		vi.clearAllMocks();
		transactionsRepository = createTransactionsRepositoryMock();
		transactionHistoriesRepository = createTransactionHistoriesRepositoryMock();
		webhookEventsRepository = createWebhookEventsRepositoryMock();
		webhookDeliveryLogsRepository = createWebhookDeliveryLogsRepositoryMock();
		sut = new GetTransactionAuditSummaryUseCase(
			transactionsRepository,
			transactionHistoriesRepository,
			webhookEventsRepository,
			webhookDeliveryLogsRepository,
		);
	});

	describe('Transaction Lookup', () => {
		it('should throw NotFoundException when transaction is not found by transactionId', async () => {
			transactionsRepository.findById.mockResolvedValueOnce(null);
			await expect(
				sut.exec({ transactionId: 'non-existent-id' }),
			).rejects.toThrow(NotFoundException);
			await expect(
				sut.exec({ transactionId: 'non-existent-id' }),
			).rejects.toThrow(errorMessages.transactions.notFound);
			expect(transactionsRepository.findById).toHaveBeenCalledWith(
				'non-existent-id',
			);
		});

		it('should throw NotFoundException when transaction is not found by externalId', async () => {
			transactionsRepository.findByExternalId.mockResolvedValueOnce(null);
			await expect(
				sut.exec({ externalId: 'non-existent-external-id' }),
			).rejects.toThrow(NotFoundException);
			expect(transactionsRepository.findByExternalId).toHaveBeenCalledWith(
				'non-existent-external-id',
			);
		});

		it('should find transaction by transactionId when provided', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			await sut.exec({ transactionId: 'transaction-id-123' });
			expect(transactionsRepository.findById).toHaveBeenCalledWith(
				'transaction-id-123',
			);
			expect(transactionsRepository.findByExternalId).not.toHaveBeenCalled();
		});

		it('should find transaction by externalId when transactionId is not provided', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findByExternalId.mockResolvedValueOnce(
				transaction,
			);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			await sut.exec({ externalId: 'external-id-456' });
			expect(transactionsRepository.findByExternalId).toHaveBeenCalledWith(
				'external-id-456',
			);
			expect(transactionsRepository.findById).not.toHaveBeenCalled();
		});
	});

	describe('Basic Output Structure', () => {
		it('should return correct transaction summary with all data', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(transaction.id.toString())
				.build();
			const transactionHistory = new TransactionHistoryEntityBuilder()
				.withTransactionId(transaction.id)
				.build();
			const deliveryLog = new WebhookDeliveryLogEntityBuilder()
				.withTransactionId(transaction.id)
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(
				webhookEvent,
			);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[deliveryLog],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result).toEqual({
				transaction: {
					id: transaction.id.toString(),
					externalId: transaction.externalId || '',
					status: transaction.status,
					amountInCents: Number(transaction.amountInCents.value),
					createdAt: transaction.createdAt,
				},
				inbound: {
					provider: webhookEvent.provider,
					status: webhookEvent.status,
					payload: webhookEvent.payload,
					headers: expect.any(Object),
					attempts: webhookEvent.attempts,
					nextRetryAt: webhookEvent.nextRetryAt,
					errorMessage: webhookEvent.errorMessage,
					receivedAt: webhookEvent.receivedAt,
				},
				timeline: [
					{
						from: transactionHistory.fromStatus,
						to: transactionHistory.toStatus,
						trigger: transactionHistory.trigger,
						createdAt: transactionHistory.createdAt,
					},
				],
				outbound: expect.any(Array),
			});
		});

		it('should return null inbound when no webhook event exists', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.inbound).toBeNull();
		});

		it('should return empty timeline when no transaction histories exist', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});

			expect(result.timeline).toEqual([]);
		});

		it('should return empty outbound when no delivery logs exist', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound).toEqual([]);
		});

		it('should map inbound data correctly when retry limit is reached', async () => {
			const transaction = new TransactionEntityBuilder().build();
			// Simula um evento que falhou todas as vezes e não tem mais retentativa
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(transaction.id.toString())
				.withStatus(EWebhookEventStatus.Failed)
				.withAttempts(6)
				.withNextRetryAt(null)
				.withErrorMessage('Max attempts reached: Connection timeout')
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(
				webhookEvent,
			);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.inbound).toMatchObject({
				status: 'Failed',
				attempts: 6,
				nextRetryAt: null,
				errorMessage: 'Max attempts reached: Connection timeout',
			});
		});
	});

	describe('Header Sanitization', () => {
		it('should sanitize sensitive headers', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(transaction.id.toString())
				.withHeaders({
					authorization: 'Bearer secret-token',
					'x-api-key': 'secret-api-key',
					'api-key': 'another-secret',
					access_token: 'access-token-value',
					'x-access-token': 'x-access-token-value',
					cookie: 'session=abc123',
					'set-cookie': 'session=xyz789',
					'content-type': 'application/json',
					'user-agent': 'Mozilla/5.0',
					'asaas-access-token': 'whsec_secret-token',
				})
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(
				webhookEvent,
			);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.inbound?.headers).toEqual({
				authorization: '[REDACTED]',
				'x-api-key': '[REDACTED]',
				'api-key': '[REDACTED]',
				access_token: '[REDACTED]',
				'x-access-token': '[REDACTED]',
				cookie: '[REDACTED]',
				'set-cookie': '[REDACTED]',
				'content-type': 'application/json',
				'user-agent': 'Mozilla/5.0',
				'asaas-access-token': '[REDACTED]',
			});
		});

		it('should handle case-insensitive header sanitization', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(transaction.id.toString())
				.withHeaders({
					Authorization: 'Bearer secret-token',
					'X-API-KEY': 'secret-api-key',
					'API-Key': 'another-secret',
					Cookie: 'session=abc123',
				})
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(
				webhookEvent,
			);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.inbound?.headers).toEqual({
				Authorization: '[REDACTED]',
				'X-API-KEY': '[REDACTED]',
				'API-Key': '[REDACTED]',
				Cookie: '[REDACTED]',
			});
		});

		it('should return empty object when headers are null', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const webhookEvent = new WebhookEventEntityBuilder()
				.withTransactionId(transaction.id.toString())
				.withHeaders(null)
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(
				webhookEvent,
			);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.inbound?.headers).toEqual({});
		});
	});

	describe('Delivery Logs Mapping', () => {
		it('should map single delivery log correctly', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const deliveryLog = new WebhookDeliveryLogEntityBuilder()
				.withTransactionId(transaction.id)
				.withUrl('https://example.com/webhook')
				.withSuccess(true)
				.withStatusCode(200)
				.withDurationInMs(150)
				.withErrorMessage(null)
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[deliveryLog],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound).toEqual([
				{
					url: 'https://example.com/webhook',
					success: true,
					statusCode: 200,
					durationInMs: 150,
					attempts: 1,
					lastAttemptAt: deliveryLog.createdAt,
					errorMessage: undefined,
				},
			]);
		});

		it('should group multiple delivery logs by URL', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const now = new Date();
			const earlier = new Date(now.getTime() - 60000); // 1 minute earlier
			const deliveryLog1 = {
				url: 'https://example.com/webhook',
				success: false,
				statusCode: 500,
				durationInMs: 100,
				errorMessage: 'Connection timeout',
				createdAt: earlier,
			} as any;
			const deliveryLog2 = {
				url: 'https://example.com/webhook',
				success: true,
				statusCode: 200,
				durationInMs: 150,
				errorMessage: null,
				createdAt: now,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[deliveryLog1, deliveryLog2],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound).toEqual([
				{
					url: 'https://example.com/webhook',
					success: true, // Has at least one success
					statusCode: 200, // From last attempt
					durationInMs: 150, // From last attempt
					attempts: 2,
					lastAttemptAt: now,
					errorMessage: undefined, // Last attempt had no error
				},
			]);
		});

		it('should handle multiple URLs correctly', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const deliveryLog1 = new WebhookDeliveryLogEntityBuilder()
				.withTransactionId(transaction.id)
				.withUrl('https://example.com/webhook1')
				.withSuccess(true)
				.withStatusCode(200)
				.build();
			const deliveryLog2 = new WebhookDeliveryLogEntityBuilder()
				.withTransactionId(transaction.id)
				.withUrl('https://example.com/webhook2')
				.withSuccess(false)
				.withStatusCode(500)
				.withErrorMessage('Server error')
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[deliveryLog1, deliveryLog2],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound).toHaveLength(2);
			expect(result.outbound).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						url: 'https://example.com/webhook1',
						success: true,
					}),
					expect.objectContaining({
						url: 'https://example.com/webhook2',
						success: false,
						errorMessage: 'Server error',
					}),
				]),
			);
		});

		it('should mark success as true if any attempt succeeded', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const now = new Date();
			const earlier = new Date(now.getTime() - 60000);
			const failedLog = {
				url: 'https://example.com/webhook',
				success: false,
				statusCode: 500,
				durationInMs: 100,
				errorMessage: null,
				createdAt: earlier,
			} as any;
			const successLog = {
				url: 'https://example.com/webhook',
				success: true,
				statusCode: 200,
				durationInMs: 150,
				errorMessage: null,
				createdAt: new Date(earlier.getTime() + 30000),
			} as any;
			const anotherFailedLog = {
				url: 'https://example.com/webhook',
				success: false,
				statusCode: 503,
				durationInMs: 200,
				errorMessage: null,
				createdAt: now,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[failedLog, successLog, anotherFailedLog],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound[0]).toMatchObject({
				success: true, // Has at least one success
				attempts: 3,
			});
		});

		it('should use last attempt data for statusCode, durationInMs, and errorMessage', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const now = new Date();
			const earlier = new Date(now.getTime() - 120000);
			const firstLog = {
				url: 'https://example.com/webhook',
				success: true,
				statusCode: 200,
				durationInMs: 100,
				errorMessage: null,
				createdAt: earlier,
			} as any;
			const lastLog = {
				url: 'https://example.com/webhook',
				success: false,
				statusCode: 503,
				durationInMs: 250,
				errorMessage: 'Service unavailable',
				createdAt: now,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[firstLog, lastLog],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.outbound[0]).toMatchObject({
				success: true, // Has at least one success
				statusCode: 503, // From last attempt
				durationInMs: 250, // From last attempt
				errorMessage: 'Service unavailable', // From last attempt
				lastAttemptAt: now,
			});
		});
	});

	describe('Retention Notice', () => {
		it('should add retention notice when no delivery logs and oldest history is older than 7 days', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

			const transactionHistory = {
				...new TransactionHistoryEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: oldDate,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			console.log({ result });
			expect(result.retentionNotice).toBe(
				'Os logs de entrega de webhook podem ter sido removidos pela política de retenção (sucesso > 7 dias, erro > 30 dias).',
			);
		});

		it('should NOT add retention notice when delivery logs exist', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 10);
			const transactionHistory = {
				...new TransactionHistoryEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: oldDate,
			} as any;
			const deliveryLog = {
				...new WebhookDeliveryLogEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: oldDate,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[deliveryLog],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.retentionNotice).toBeUndefined();
		});

		it('should NOT add retention notice when oldest history is 7 days or less', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 5); // 5 days ago
			const transactionHistory = {
				...new TransactionHistoryEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: recentDate,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.retentionNotice).toBeUndefined();
		});

		it('should NOT add retention notice when no transaction histories exist', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.retentionNotice).toBeUndefined();
		});

		it('should add retention notice exactly at 8 days (boundary test)', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 8); // Exactly 8 days ago
			const transactionHistory = {
				...new TransactionHistoryEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: oldDate,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.retentionNotice).toBe(
				'Os logs de entrega de webhook podem ter sido removidos pela política de retenção (sucesso > 7 dias, erro > 30 dias).',
			);
		});

		it('should NOT add retention notice exactly at 7 days (boundary test)', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7); // Exactly 7 days ago
			const transactionHistory = {
				...new TransactionHistoryEntityBuilder()
					.withTransactionId(transaction.id)
					.build(),
				createdAt: oldDate,
			} as any;
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[transactionHistory],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			expect(result.retentionNotice).toBeUndefined();
		});
	});

	describe('Timeline Mapping', () => {
		it('should map multiple transaction histories correctly', async () => {
			const transaction = new TransactionEntityBuilder().build();
			const history1 = new TransactionHistoryEntityBuilder()
				.withTransactionId(transaction.id)
				.withFromStatus('pending')
				.withToStatus('processing')
				.withTrigger('webhook')
				.build();
			const history2 = new TransactionHistoryEntityBuilder()
				.withTransactionId(transaction.id)
				.withFromStatus('processing')
				.withToStatus('paid')
				.withTrigger('webhook')
				.build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[history1, history2],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			const result = await sut.exec({
				transactionId: transaction.id.toString(),
			});
			console.log({ result });
			expect(result.timeline).toEqual([
				{
					from: 'pending',
					to: 'processing',
					trigger: 'webhook',
					createdAt: history1.createdAt,
				},
				{
					from: 'processing',
					to: 'paid',
					trigger: 'webhook',
					createdAt: history2.createdAt,
				},
			]);
		});
	});

	describe('Parallel Data Fetching', () => {
		it('should fetch all related data in parallel', async () => {
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findById.mockResolvedValueOnce(transaction);
			webhookEventsRepository.findByTransactionId.mockResolvedValueOnce(null);
			transactionHistoriesRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			webhookDeliveryLogsRepository.findManyByTransactionId.mockResolvedValueOnce(
				[],
			);
			await sut.exec({ transactionId: transaction.id.toString() });
			const transactionId = transaction.id.toString();
			expect(webhookEventsRepository.findByTransactionId).toHaveBeenCalledWith(
				transactionId,
			);
			expect(
				transactionHistoriesRepository.findManyByTransactionId,
			).toHaveBeenCalledWith(transactionId);
			expect(
				webhookDeliveryLogsRepository.findManyByTransactionId,
			).toHaveBeenCalledWith(transactionId);
		});
	});
});
