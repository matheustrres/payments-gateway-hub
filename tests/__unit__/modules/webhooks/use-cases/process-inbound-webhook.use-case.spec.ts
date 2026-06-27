import { Mocked } from 'vitest';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';

import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookQueueProducerPort } from '@/modules/webhooks/application/ports/queue-producer.port';
import {
	IWebhookParserPort,
	NormalizedWebhookEvent,
} from '@/modules/webhooks/application/ports/webhook-parser.port';
import { ProcessInboundWebhookUseCaseInput } from '@/modules/webhooks/application/use-cases/dtos/process-inbound.dto';
import { ProcessInboundWebhookUseCase } from '@/modules/webhooks/application/use-cases/process-inbound-webhook/process-inbound-webhook.use-case';
import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

import { TransactionEntityBuilder } from '#/data/builders/entities/transaction.entity.builder';
import { createWebhookParserPortMock } from '#/data/mocks/ports/webhook-parser.port';
import { createMockWebhookQueueProducerPort } from '#/data/mocks/ports/webhook-queue-producer.port';
import { createTransactionHistoriesRepositoryMock } from '#/data/mocks/repositories/transaction-histories.repository';
import { createTransactionsRepositoryMock } from '#/data/mocks/repositories/transactions.repository';
import { createWebhookEventsRepositoryMock } from '#/data/mocks/repositories/webhook-events.repository';

describe(ProcessInboundWebhookUseCase.name, () => {
	let sut: ProcessInboundWebhookUseCase;
	let webhookEventsRepository: Mocked<IWebhookEventsRepository>;
	let transactionsRepository: Mocked<ITransactionsRepository>;
	let transactionHistoriesRepository: Mocked<ITransactionHistoriesRepository>;
	let abacatePayParser: Mocked<IWebhookParserPort>;
	let webhookParsers: IWebhookParserPort[];
	let queueProducer: IWebhookQueueProducerPort;

	const defaultInput: ProcessInboundWebhookUseCaseInput = {
		projectId: 'project-123',
		provider: EPaymentProvider.AbacatePay,
		payload: {
			event: 'billing.paid',
			data: { id: 'charge-123', status: 'paid' },
		},
		headers: {
			'abacate-signature': 'sha256=test-signature',
		},
	};

	const defaultNormalizedEvent: NormalizedWebhookEvent = {
		externalId: 'charge-123',
		currentStatus: EPaymentStatus.Paid,
		metadata: { billingId: 'charge-123' },
		rawEventType: 'billing.paid',
		provider: EPaymentProvider.AbacatePay,
		providerEventId: 'evt_abc123',
		rawStatus: 'paid',
	};

	beforeEach(() => {
		webhookEventsRepository = createWebhookEventsRepositoryMock();
		webhookEventsRepository.findByExternalEventId = vi
			.fn()
			.mockResolvedValue(null);
		transactionsRepository = createTransactionsRepositoryMock();
		abacatePayParser = createWebhookParserPortMock();
		vi.spyOn(abacatePayParser, 'supports').mockImplementation(
			(provider) => provider === EPaymentProvider.AbacatePay,
		);
		vi.spyOn(abacatePayParser, 'parse').mockReturnValue(defaultNormalizedEvent);
		webhookParsers = [abacatePayParser];
		queueProducer = createMockWebhookQueueProducerPort();
		transactionHistoriesRepository = createTransactionHistoriesRepositoryMock();
		sut = new ProcessInboundWebhookUseCase(
			webhookParsers,
			webhookEventsRepository,
			transactionsRepository,
			queueProducer,
			transactionHistoriesRepository,
		);
	});

	describe('webhook event creation', () => {
		it('should create a new webhook event with pending status', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			let capturedEvent: any;
			vi.spyOn(webhookEventsRepository, 'insertOne').mockImplementation(
				async (event) => {
					capturedEvent = {
						provider: event.provider,
						payload: event.payload,
						headers: event.headers,
						status: event.status,
					};
				},
			);
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.insertOne).toHaveBeenCalledTimes(1);
			expect(capturedEvent.provider).toBe(defaultInput.provider);
			expect(capturedEvent.payload).toEqual(defaultInput.payload);
			expect(capturedEvent.headers).toEqual(defaultInput.headers);
			expect(capturedEvent.status).toBe(EWebhookEventStatus.Pending);
		});
	});

	describe('parser selection', () => {
		it('should select the correct parser for the provider', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(abacatePayParser.supports).toHaveBeenCalledWith(
				EPaymentProvider.AbacatePay,
			);
			expect(abacatePayParser.parse).toHaveBeenCalledWith(defaultInput.payload);
		});

		it('should handle unsupported provider', async () => {
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			const input: ProcessInboundWebhookUseCaseInput = {
				projectId: 'project-123',
				provider: EPaymentProvider.Asaas,
				payload: {},
				headers: {},
			};
			await sut.exec(input);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('No parser found for provider'),
			);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Failed,
						errorMessage: 'Unsupported webhook provider',
					}),
				}),
			);
			loggerWarnSpy.mockRestore();
		});
	});

	describe('event parsing', () => {
		it('should handle ignored events when parser returns null', async () => {
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(null);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Ignored,
					}),
				}),
			);
			loggerWarnSpy.mockRestore();
		});

		it('should parse webhook payload successfully', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(abacatePayParser.parse).toHaveBeenCalledWith(defaultInput.payload);
		});
	});

	describe('transaction update', () => {
		it('should update transaction status when transaction is found', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(
				transactionsRepository.findByExternalIdAndProjectId,
			).toHaveBeenCalledWith(
				defaultNormalizedEvent.externalId,
				defaultInput.projectId,
			);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: defaultNormalizedEvent.currentStatus,
					}),
				}),
			);
		});

		it('should not update transaction if status is already paid', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Paid)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
					}),
				}),
			);
		});

		it('should handle transaction not found', async () => {
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(null);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Transaction not found for externalId'),
			);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Ignored,
						errorMessage: 'Transaction not found',
					}),
				}),
			);
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
			loggerWarnSpy.mockRestore();
		});

		it('should set transactionId on webhook event when transaction is found', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						transactionId: transaction.id.toString(),
					}),
				}),
			);
		});

		it('should correctly merge metadata', async () => {
			const existingMetadata = { oldKey: 'oldValue' };
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			(transaction as any).props.paymentData = existingMetadata;
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			const normalizedEventWithMetadata: NormalizedWebhookEvent = {
				...defaultNormalizedEvent,
				metadata: { newKey: 'newValue' },
			};
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(
				normalizedEventWithMetadata,
			);
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						paymentData: {
							oldKey: 'oldValue',
							newKey: 'newValue',
						},
					}),
				}),
			);
		});
	});

	describe('webhook event finalization', () => {
		it('should mark webhook event as processed when successful', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
						processedAt: expect.any(Date),
					}),
				}),
			);
		});

		it('should update webhook event even if status is not pending', async () => {
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(null);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalled();
			loggerWarnSpy.mockRestore();
		});
	});

	describe('error handling', () => {
		it('should handle system errors and mark webhook as failed', async () => {
			const error = new Error('Database connection failed');
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(abacatePayParser, 'parse').mockImplementation(() => {
				throw error;
			});
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				'Error processing inbound webhook',
				error,
			);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Pending,
						errorMessage: error.message,
						attempts: 1,
						nextRetryAt: expect.any(Date),
					}),
				}),
			);
			loggerErrorSpy.mockRestore();
		});

		it('should handle unknown errors', async () => {
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(abacatePayParser, 'parse').mockImplementation(() => {
				throw 'Unknown error';
			});
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Pending,
						errorMessage: 'Unknown error',
						attempts: 1,
						nextRetryAt: expect.any(Date),
					}),
				}),
			);
			loggerErrorSpy.mockRestore();
		});

		it('should log error if webhook event persistence fails during error handling', async () => {
			const parseError = new Error('Parse error');
			const persistError = new Error('Persist error');
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(abacatePayParser, 'parse').mockImplementation(() => {
				throw parseError;
			});
			vi.spyOn(webhookEventsRepository, 'updateOne').mockRejectedValueOnce(
				persistError,
			);
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
			expect(loggerErrorSpy).toHaveBeenNthCalledWith(
				1,
				'Error processing inbound webhook',
				parseError,
			);
			expect(loggerErrorSpy).toHaveBeenNthCalledWith(
				2,
				'Failed to persist webhook error state',
				persistError,
			);
			loggerErrorSpy.mockRestore();
		});
	});

	describe('different payment statuses', () => {
		it('should handle pending status update', async () => {
			const normalizedEvent: NormalizedWebhookEvent = {
				...defaultNormalizedEvent,
				currentStatus: EPaymentStatus.Pending,
			};
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(normalizedEvent);
			const transaction = new TransactionEntityBuilder()
				.withExternalId(normalizedEvent.externalId)
				.withStatus(EPaymentStatus.Cancelled)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EPaymentStatus.Pending,
					}),
				}),
			);
		});

		it('should handle failed status update', async () => {
			const normalizedEvent: NormalizedWebhookEvent = {
				...defaultNormalizedEvent,
				currentStatus: EPaymentStatus.Failed,
			};
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(normalizedEvent);
			const transaction = new TransactionEntityBuilder()
				.withExternalId(normalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EPaymentStatus.Failed,
					}),
				}),
			);
		});

		it('should handle cancelled status update', async () => {
			const normalizedEvent: NormalizedWebhookEvent = {
				...defaultNormalizedEvent,
				currentStatus: EPaymentStatus.Cancelled,
			};
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(normalizedEvent);
			const transaction = new TransactionEntityBuilder()
				.withExternalId(normalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EPaymentStatus.Cancelled,
					}),
				}),
			);
		});
	});

	describe('queue dispatch', () => {
		it('should dispatch to queue when transaction becomes paid', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			expect(dispatchSpy).toHaveBeenCalledTimes(1);
			expect(dispatchSpy).toHaveBeenCalledWith({
				transactionId: transaction.id.toString(),
				projectId: defaultInput.projectId,
				fromStatus: EPaymentStatus.Pending,
			});
		});

		it('should not dispatch to queue when transaction is already paid', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Paid)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			expect(dispatchSpy).not.toHaveBeenCalled();
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
		});

		it('should not dispatch to queue when status is not paid', async () => {
			const normalizedEvent: NormalizedWebhookEvent = {
				...defaultNormalizedEvent,
				currentStatus: EPaymentStatus.Failed,
			};
			vi.spyOn(abacatePayParser, 'parse').mockReturnValueOnce(normalizedEvent);
			const transaction = new TransactionEntityBuilder()
				.withExternalId(normalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			// Queue dispatch is now called for all status updates
			expect(dispatchSpy).toHaveBeenCalled();
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EPaymentStatus.Failed,
					}),
				}),
			);
		});

		it('should not dispatch to queue when transaction is not found', async () => {
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(null);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(dispatchSpy).not.toHaveBeenCalled();
			loggerWarnSpy.mockRestore();
		});

		it('should dispatch to queue when status changes from pending to paid', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.exec(defaultInput);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('updated to'),
			);
			expect(dispatchSpy).toHaveBeenCalledWith({
				transactionId: transaction.id.toString(),
				projectId: defaultInput.projectId,
				fromStatus: EPaymentStatus.Pending,
			});
			loggerLogSpy.mockRestore();
		});

		it('should not dispatch if status remains the same (idempotency)', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.withStatus(EPaymentStatus.Paid)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			expect(dispatchSpy).not.toHaveBeenCalled();
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
					}),
				}),
			);
		});

		it('should prevent downgrade from PAID to PENDING (stale webhook)', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId('charge-123')
				.withStatus(EPaymentStatus.Paid)
				.build();
			const staleEvent: NormalizedWebhookEvent = {
				externalId: 'charge-123',
				currentStatus: EPaymentStatus.Pending,
				rawEventType: 'payment.created',
				metadata: {},
				providerEventId: 'evt_abc123',
				provider: EPaymentProvider.AbacatePay,
				rawStatus: 'paid',
			};
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(abacatePayParser, 'parse').mockReturnValue(staleEvent);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
						errorMessage:
							'Stale webhook: ignored transition from PAID to PENDING',
					}),
				}),
			);
		});

		it('should prevent downgrade from PAID to FAILED (stale webhook)', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId('charge-456')
				.withStatus(EPaymentStatus.Paid)
				.build();
			const staleEvent: NormalizedWebhookEvent = {
				externalId: 'charge-456',
				currentStatus: EPaymentStatus.Failed,
				rawEventType: 'payment.failed',
				metadata: {},
				providerEventId: 'evt_abc123',
				provider: EPaymentProvider.AbacatePay,
				rawStatus: 'paid',
			};
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(abacatePayParser, 'parse').mockReturnValue(staleEvent);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).not.toHaveBeenCalled();
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
						errorMessage:
							'Stale webhook: ignored transition from PAID to FAILED',
					}),
				}),
			);
		});

		it('should allow valid progression from PAID to REFUNDED', async () => {
			const transaction = new TransactionEntityBuilder()
				.withExternalId('charge-789')
				.withStatus(EPaymentStatus.Paid)
				.build();
			const refundEvent: NormalizedWebhookEvent = {
				externalId: 'charge-789',
				currentStatus: EPaymentStatus.Refunded,
				rawEventType: 'payment.refunded',
				metadata: {},
				providerEventId: 'evt_abc123',
				provider: EPaymentProvider.AbacatePay,
				rawStatus: 'paid',
			};
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(abacatePayParser, 'parse').mockReturnValue(refundEvent);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			await sut.exec(defaultInput);
			expect(transactionsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EPaymentStatus.Refunded,
					}),
				}),
			);
			expect(webhookEventsRepository.updateOne).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						status: EWebhookEventStatus.Processed,
					}),
				}),
			);
		});
	});

	describe('different providers', () => {
		it('should handle Asaas provider when parser is available', async () => {
			const asaasParser = createWebhookParserPortMock();
			vi.spyOn(asaasParser, 'supports').mockImplementation(
				(provider) => provider === EPaymentProvider.Asaas,
			);
			vi.spyOn(asaasParser, 'parse').mockReturnValue(defaultNormalizedEvent);
			const sutWithAsaas = new ProcessInboundWebhookUseCase(
				[abacatePayParser, asaasParser],
				webhookEventsRepository,
				transactionsRepository,
				queueProducer,
				transactionHistoriesRepository,
			);
			const transaction = new TransactionEntityBuilder()
				.withExternalId(defaultNormalizedEvent.externalId)
				.build();
			vi.spyOn(
				transactionsRepository,
				'findByExternalIdAndProjectId',
			).mockResolvedValueOnce(transaction);
			vi.spyOn(webhookEventsRepository, 'insertOne').mockResolvedValueOnce();
			vi.spyOn(webhookEventsRepository, 'updateOne').mockResolvedValueOnce();
			vi.spyOn(transactionsRepository, 'updateOne').mockResolvedValueOnce();
			const input: ProcessInboundWebhookUseCaseInput = {
				projectId: 'project-123',
				provider: EPaymentProvider.Asaas,
				payload: { event: 'payment_received' },
				headers: {},
			};
			await sutWithAsaas.exec(input);
			expect(asaasParser.supports).toHaveBeenCalledWith(EPaymentProvider.Asaas);
			expect(asaasParser.parse).toHaveBeenCalledWith(input.payload);
		});
	});

	describe('retry logic', () => {
		it('should use existing webhook event instead of creating a new one if eventId is provided', async () => {
			const existingEvent = WebhookEventEntity.createNew({
				projectId: EntityCuid.createFrom(defaultInput.projectId),
				provider: defaultInput.provider,
				payload: defaultInput.payload,
				headers: defaultInput.headers,
				receivedAt: new Date(),
				status: EWebhookEventStatus.Pending,
			});
			webhookEventsRepository.findById.mockResolvedValueOnce(existingEvent);
			const transaction = new TransactionEntityBuilder().build();
			transactionsRepository.findByExternalIdAndProjectId.mockResolvedValueOnce(
				transaction,
			);
			await sut.exec({ ...defaultInput, eventId: 'existing-event-id' });
			expect(webhookEventsRepository.findById).toHaveBeenCalledWith(
				'existing-event-id',
			);
			expect(webhookEventsRepository.insertOne).not.toHaveBeenCalled(); // Garante que não criou duplicado
			expect(webhookEventsRepository.updateOne).toHaveBeenCalled(); // Garante que atualizou o existente
		});
	});
});
