import { createHmac } from 'node:crypto';

import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EPaymentMethod, EPaymentProvider } from '@/core/enums/payment';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';
import { SqsWebhookConsumerJob } from '@/modules/webhooks/infra/adapters/queues/consumers/sqs-webhook-consumer.job';

import { EnvService } from '@/shared/modules/env/env.service';
import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

import { createProjectsRepositoryMock } from '#/data/mocks/repositories/projects.repository';
import { createTransactionsRepositoryMock } from '#/data/mocks/repositories/transactions.repository';
import { createWebhookDeliveryLogsRepositoryMock } from '#/data/mocks/repositories/webhook-delivery-logs.repository';

vi.mock('@aws-sdk/client-sqs', () => ({
	SQSClient: vi.fn(),
	ReceiveMessageCommand: vi.fn(),
	DeleteMessageCommand: vi.fn(),
}));

vi.mock('rxjs', () => ({
	firstValueFrom: vi.fn((observable) => Promise.resolve(observable)),
}));

describe(SqsWebhookConsumerJob.name, () => {
	let sut: SqsWebhookConsumerJob;
	let envService: EnvService;
	let transactionsRepository: ITransactionsRepository;
	let projectsRepository: IProjectsRepository;
	let webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository;
	let httpService: IHttpRequestingService;
	let mockSqsClient: {
		send: ReturnType<typeof vi.fn>;
	};

	const mockQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
	const mockRegion = 'us-east-1';
	const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
	const mockSecretAccessKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		mockSqsClient = {
			send: vi.fn(),
		};
		(SQSClient as any).mockImplementation(() => mockSqsClient);
		envService = {
			getKeyOrThrow: vi.fn((key: string) => {
				const env: Record<string, string> = {
					AWS_SQS_QUEUE_OUTBOUND_URL: mockQueueUrl,
					AWS_REGION: mockRegion,
					AWS_ACCESS_KEY_ID: mockAccessKeyId,
					AWS_SECRET_ACCESS_KEY: mockSecretAccessKey,
				};
				return env[key];
			}),
		} as any;
		transactionsRepository = createTransactionsRepositoryMock();
		projectsRepository = createProjectsRepositoryMock();
		webhookDeliveryLogsRepository = createWebhookDeliveryLogsRepositoryMock();
		httpService = {
			post: vi.fn(),
		} as any;

		sut = new SqsWebhookConsumerJob(
			mockSqsClient as any,
			envService,
			transactionsRepository,
			projectsRepository,
			webhookDeliveryLogsRepository,
			httpService,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		if (sut) {
			sut.onModuleDestroy();
		}
	});

	describe('constructor', () => {
		it('should retrieve queue URL from environment', () => {
			expect(envService.getKeyOrThrow).toHaveBeenCalledWith(
				'AWS_SQS_QUEUE_OUTBOUND_URL',
			);
		});
	});

	describe('onModuleInit', () => {
		it('should start polling when queueUrl is configured', () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();

			expect(mockSqsClient.send).toHaveBeenCalled();
		});

		it('should NOT start polling when queueUrl is missing', () => {
			const envServiceWithoutUrl = {
				getKeyOrThrow: vi.fn((key: string) => {
					if (key === 'AWS_SQS_QUEUE_OUTBOUND_URL') return '';
					return mockRegion;
				}),
			} as any;

			const consumerWithoutUrl = new SqsWebhookConsumerJob(
				mockSqsClient as any,
				envServiceWithoutUrl,
				transactionsRepository,
				projectsRepository,
				webhookDeliveryLogsRepository,
				httpService,
			);

			consumerWithoutUrl.onModuleInit();

			expect(mockSqsClient.send).not.toHaveBeenCalled();

			consumerWithoutUrl.onModuleDestroy();
		});
	});

	describe('onModuleDestroy', () => {
		it('should stop polling', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();

			await vi.runOnlyPendingTimersAsync();

			const initialCallCount = mockSqsClient.send.mock.calls.length;

			sut.onModuleDestroy();

			await vi.advanceTimersByTimeAsync(1000);

			expect(mockSqsClient.send).toHaveBeenCalledTimes(initialCallCount);
		});

		it('should set isPolling to false', () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();
			sut.onModuleDestroy();

			expect(sut['isPolling']).toBe(false);
		});
	});

	describe('polling behavior', () => {
		it('should send ReceiveMessageCommand with correct parameters', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();

			await vi.runOnlyPendingTimersAsync();

			expect(ReceiveMessageCommand).toHaveBeenCalledWith({
				QueueUrl: mockQueueUrl,
				MaxNumberOfMessages: 1,
				WaitTimeSeconds: 20,
				VisibilityTimeout: 30,
			});
		});

		it('should continue polling after receiving empty messages', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();

			await vi.runOnlyPendingTimersAsync();

			const firstCallCount = mockSqsClient.send.mock.calls.length;

			await vi.runOnlyPendingTimersAsync();

			expect(mockSqsClient.send.mock.calls.length).toBeGreaterThan(
				firstCallCount,
			);
		});

		it('should handle polling errors gracefully and continue polling', async () => {
			mockSqsClient.send
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({ Messages: [] })
				.mockResolvedValue({ Messages: [] });

			sut.onModuleInit();

			await vi.runOnlyPendingTimersAsync();
			await vi.runOnlyPendingTimersAsync();

			expect(mockSqsClient.send.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('handleMessage', () => {
		const mockTransaction = {
			id: { toString: () => 'txn_12345' },
			externalId: 'ext_67890',
			idempotencyKey: 'idem_abc',
			status: 'PAID',
			externalStatus: 'confirmed',
			amountInCents: { toJSON: () => 10000 },
			paymentMethod: EPaymentMethod.Card,
			provider: EPaymentProvider.Asaas,
			customerEmail: 'customer@example.com',
			customerTaxId: '12345678900',
			paymentUrl: 'https://pay.example.com/12345',
			paymentData: JSON.stringify({ method: 'CREDIT_CARD' }),
		} as unknown as TransactionEntity;

		const mockProject = {
			id: { toString: () => 'proj_123' },
			webhookUrl: 'https://webhook.example.com/notify',
			apiKeys: {
				live: {
					hash: 'live-secret-key-123',
				},
			},
		} as unknown as ProjectEntity;

		const mockMessage = {
			MessageId: 'msg-12345',
			Body: JSON.stringify({
				transactionId: 'txn_12345',
				projectId: 'proj_123',
			}),
			ReceiptHandle: 'receipt-handle-12345',
		};

		describe('successful processing', () => {
			beforeEach(() => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockReturnValue(
					Promise.resolve({ data: {} }) as any,
				);
				mockSqsClient.send.mockResolvedValue({});
			});

			it('should process valid message successfully', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(transactionsRepository.findById).toHaveBeenCalledWith(
					'txn_12345',
				);
				expect(projectsRepository.findById).toHaveBeenCalledWith('proj_123');
				expect(httpService.post).toHaveBeenCalled();
			});

			it('should send webhook with correct payload structure', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const payload = postCall[1];

				expect(payload).toMatchObject({
					eventId: 'msg-12345',
					eventType: 'transaction.paid',
					data: {
						transactionId: 'txn_12345',
						amount: 10000,
						paymentMethod: EPaymentMethod.Card,
						provider: {
							id: 'ext_67890',
							name: EPaymentProvider.Asaas,
							status: 'confirmed',
						},
						customer: {
							email: 'customer@example.com',
							taxId: '12345678900',
						},
						resources: {
							paymentUrl: 'https://pay.example.com/12345',
						},
					},
				});
			});

			it('should include timestamp in payload', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const payload = postCall[1];

				expect(payload.timestamp).toBeDefined();
				expect(typeof payload.timestamp).toBe('string');
				expect(() => new Date(payload.timestamp)).not.toThrow();
			});

			it('should send webhook to correct URL', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(httpService.post).toHaveBeenCalledWith(
					'https://webhook.example.com/notify',
					expect.any(Object),
					expect.any(Object),
				);
			});

			it('should include correct headers', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const options = postCall[2];

				expect(options.headers).toMatchObject({
					'Content-Type': 'application/json',
					'User-Agent': 'Hub-Payments-Webhook/1.0',
					'X-Event-Id': 'msg-12345',
				});
				expect(options.headers['x-hub-signature']).toBeDefined();
			});

			it('should generate valid HMAC signature', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const payload = postCall[1];
				const signature = postCall[2].headers['x-hub-signature'];

				const expectedSignature = createHmac('sha256', 'live-secret-key-123')
					.update(JSON.stringify(payload))
					.digest('hex');

				expect(signature).toBe(expectedSignature);
			});

			it('should delete message after successful delivery', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalledWith({
					QueueUrl: mockQueueUrl,
					ReceiptHandle: 'receipt-handle-12345',
				});
			});

			it('should parse paymentData when it is a string', async () => {
				const transactionWithStringData = {
					...mockTransaction,
					paymentData: '{"method":"CREDIT_CARD","cardBrand":"VISA"}',
				} as unknown as TransactionEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					transactionWithStringData,
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const payload = postCall[1];

				// Verify that the webhook was sent successfully
				expect(payload).toBeDefined();
				expect(payload.data).toBeDefined();
			});

			it('should use paymentData directly when it is an object', async () => {
				const transactionWithObjectData = {
					...mockTransaction,
					paymentData: { method: 'PIX', qrCode: 'qr-code-data' },
				} as unknown as TransactionEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					transactionWithObjectData,
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const payload = postCall[1];

				// Verify that the webhook was sent successfully
				expect(payload).toBeDefined();
				expect(payload.data).toBeDefined();
			});

			it('should set timeout to 5 seconds', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				const postCall = (httpService.post as any).mock.calls[0];
				const options = postCall[2];

				expect(options.timeout).toBe(5000);
			});
		});

		describe('message discarding scenarios', () => {
			it('should discard message when transaction is not found', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(null);
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [mockMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalledWith({
					QueueUrl: mockQueueUrl,
					ReceiptHandle: 'receipt-handle-12345',
				});
				expect(httpService.post).not.toHaveBeenCalled();
			});

			it('should discard message when project is not found', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(null);
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [mockMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalled();
				expect(httpService.post).not.toHaveBeenCalled();
			});

			it('should discard message when webhookUrl is missing', async () => {
				const projectWithoutWebhook = {
					...mockProject,
					webhookUrl: null,
				} as unknown as ProjectEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(
					projectWithoutWebhook,
				);
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [mockMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalled();
				expect(httpService.post).not.toHaveBeenCalled();
			});

			it('should discard message when webhookUrl is empty string', async () => {
				const projectWithEmptyWebhook = {
					...mockProject,
					webhookUrl: '',
				} as unknown as ProjectEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(
					projectWithEmptyWebhook,
				);
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [mockMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalled();
				expect(httpService.post).not.toHaveBeenCalled();
			});
		});

		describe('error handling and retry strategy', () => {
			it('should NOT delete message when webhook delivery fails', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockRejectedValue(
					new Error('Network error'),
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).not.toHaveBeenCalled();
			});

			it('should handle HTTP timeout errors', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockRejectedValue(
					new Error('Timeout exceeded'),
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).not.toHaveBeenCalled();
			});

			it('should handle HTTP 5xx errors', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockRejectedValue(
					new Error('Internal Server Error'),
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).not.toHaveBeenCalled();
			});

			it('should handle malformed message body', async () => {
				const malformedMessage = {
					...mockMessage,
					Body: 'invalid-json-{',
				};

				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [malformedMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(httpService.post).not.toHaveBeenCalled();
			});

			it('should handle message with missing transactionId', async () => {
				const invalidMessage = {
					...mockMessage,
					Body: JSON.stringify({ projectId: 'proj_123' }),
				};

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(null);

				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [invalidMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalled();
			});

			it('should handle message with missing projectId', async () => {
				const invalidMessage = {
					...mockMessage,
					Body: JSON.stringify({ transactionId: 'txn_123' }),
				};

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(null);

				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [invalidMessage],
					})
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(DeleteMessageCommand).toHaveBeenCalled();
			});
		});

		describe('edge cases', () => {
			it('should handle multiple messages in sequence', async () => {
				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockReturnValue(
					Promise.resolve({ data: {} }) as any,
				);

				const message1 = { ...mockMessage, MessageId: 'msg-1' };
				const message2 = { ...mockMessage, MessageId: 'msg-2' };
				const message3 = { ...mockMessage, MessageId: 'msg-3' };

				mockSqsClient.send
					.mockResolvedValueOnce({ Messages: [message1] })
					.mockResolvedValueOnce({})
					.mockResolvedValueOnce({ Messages: [message2] })
					.mockResolvedValueOnce({})
					.mockResolvedValueOnce({ Messages: [message3] })
					.mockResolvedValue({});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();
				await vi.runOnlyPendingTimersAsync();
				await vi.runOnlyPendingTimersAsync();

				expect(httpService.post).toHaveBeenCalledTimes(3);
			});

			it('should handle transaction with null paymentData', async () => {
				const transactionWithNullData = {
					...mockTransaction,
					paymentData: null,
				} as unknown as TransactionEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					transactionWithNullData,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(mockProject);
				vi.spyOn(httpService, 'post').mockReturnValue(
					Promise.resolve({ data: {} }) as any,
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(httpService.post).toHaveBeenCalled();
			});

			it('should handle very long webhook URLs', async () => {
				const projectWithLongUrl = {
					...mockProject,
					webhookUrl: 'https://example.com/' + 'path/'.repeat(100),
				} as unknown as ProjectEntity;

				vi.spyOn(transactionsRepository, 'findById').mockResolvedValue(
					mockTransaction,
				);
				vi.spyOn(projectsRepository, 'findById').mockResolvedValue(
					projectWithLongUrl,
				);
				vi.spyOn(httpService, 'post').mockReturnValue(
					Promise.resolve({ data: {} }) as any,
				);

				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});

				sut.onModuleInit();

				await vi.runOnlyPendingTimersAsync();

				expect(httpService.post).toHaveBeenCalledWith(
					projectWithLongUrl.webhookUrl,
					expect.any(Object),
					expect.any(Object),
				);
			});
		});
	});
});
