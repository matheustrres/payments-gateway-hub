import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';
import { SqsDlqMonitorJob } from '@/modules/webhooks/infra/adapters/queues/monitor/sqs-dlq-monitor.job';

import { EnvService } from '@/shared/modules/env/env.service';

import { createWebhookDeliveryLogsRepositoryMock } from '#/data/mocks/repositories/webhook-delivery-logs.repository';

vi.mock('@aws-sdk/client-sqs', () => ({
	SQSClient: vi.fn(),
	ReceiveMessageCommand: vi.fn(),
	DeleteMessageCommand: vi.fn(),
}));

describe(SqsDlqMonitorJob.name, () => {
	let sut: SqsDlqMonitorJob;
	let envService: EnvService;
	let webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository;
	let mockSqsClient: {
		send: ReturnType<typeof vi.fn>;
	};

	const mockDlqUrl =
		'https://sqs.us-east-1.amazonaws.com/123456789/outbound-dlq';
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
					AWS_SQS_QUEUE_OUTBOUND_DLQ_URL: mockDlqUrl,
					AWS_REGION: mockRegion,
					AWS_ACCESS_KEY_ID: mockAccessKeyId,
					AWS_SECRET_ACCESS_KEY: mockSecretAccessKey,
				};
				return env[key];
			}),
		} as any;
		webhookDeliveryLogsRepository = createWebhookDeliveryLogsRepositoryMock();
		sut = new SqsDlqMonitorJob(
			mockSqsClient as any,
			envService,
			webhookDeliveryLogsRepository,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		if (sut) {
			sut.onModuleDestroy();
		}
	});

	describe('constructor', () => {
		it('should retrieve DLQ URL from environment', () => {
			expect(envService.getKeyOrThrow).toHaveBeenCalledWith(
				'AWS_SQS_QUEUE_OUTBOUND_DLQ_URL',
			);
		});
	});

	describe('onModuleInit', () => {
		it('should start polling when DLQ URL is configured', () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });
			sut.onModuleInit();
			expect(mockSqsClient.send).toHaveBeenCalled();
		});

		it('should NOT start polling when DLQ URL is missing', () => {
			const envServiceWithoutUrl = {
				getKeyOrThrow: vi.fn((key: string) => {
					if (key === 'AWS_SQS_QUEUE_OUTBOUND_DLQ_URL') return '';
					return mockRegion;
				}),
			} as any;
			const monitorWithoutUrl = new SqsDlqMonitorJob(
				mockSqsClient as any,
				envServiceWithoutUrl,
				webhookDeliveryLogsRepository,
			);
			monitorWithoutUrl.onModuleInit();
			expect(mockSqsClient.send).not.toHaveBeenCalled();
			monitorWithoutUrl.onModuleDestroy();
		});

		it('should log starting message when polling begins', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			sut.onModuleInit();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Starting SQS Polling for Dead Letter Queue (Outbound)...',
			);
			loggerLogSpy.mockRestore();
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

		it('should clear polling timeout', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });
			sut.onModuleInit();
			await vi.runOnlyPendingTimersAsync();
			const timeoutBeforeDestroy = sut['pollingTimeout'];
			expect(timeoutBeforeDestroy).not.toBeNull();
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
				QueueUrl: mockDlqUrl,
				MaxNumberOfMessages: 1,
				WaitTimeSeconds: 20,
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
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			sut.onModuleInit();
			await vi.runOnlyPendingTimersAsync();
			await vi.runOnlyPendingTimersAsync();
			expect(mockSqsClient.send.mock.calls.length).toBeGreaterThanOrEqual(2);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				'Error polling DLQ messages',
				expect.any(Error),
			);
			loggerErrorSpy.mockRestore();
		});

		it('should poll with 1 second interval between iterations', async () => {
			mockSqsClient.send.mockResolvedValue({ Messages: [] });
			sut.onModuleInit();
			await vi.runOnlyPendingTimersAsync();
			const initialCallCount = mockSqsClient.send.mock.calls.length;
			// Advance by less than 1 second - should not trigger new poll
			await vi.advanceTimersByTimeAsync(500);
			expect(mockSqsClient.send).toHaveBeenCalledTimes(initialCallCount);
			// Advance by remaining time - should trigger new poll
			await vi.advanceTimersByTimeAsync(500);
			expect(mockSqsClient.send.mock.calls.length).toBeGreaterThan(
				initialCallCount,
			);
		});
	});

	describe('handleDlqMessage', () => {
		const mockMessage = {
			MessageId: 'msg-dlq-12345',
			Body: JSON.stringify({
				transactionId: 'txn_67890',
				projectId: 'proj_abc',
			}),
			ReceiptHandle: 'receipt-handle-dlq-12345',
		};

		describe('successful processing', () => {
			beforeEach(() => {
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValue({});
			});

			it('should process valid DLQ message successfully', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalled();
			});

			it('should create delivery log with correct structure', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				const insertCall = (webhookDeliveryLogsRepository.insertOne as any).mock
					.calls[0][0];
				expect(insertCall.transactionId.toString()).toBe('txn_67890');
				expect(insertCall.projectId.toString()).toBe('proj_abc');
				expect(insertCall.eventType).toBe('webhook.discarded');
				expect(insertCall.url).toBe('N/A');
				expect(insertCall.statusCode).toBeNull();
				expect(insertCall.success).toBe(false);
				expect(insertCall.errorMessage).toBe(
					'MAX_RETRIES_REACHED: Message moved to DLQ and discarded.',
				);
				expect(insertCall.durationInMs).toBe(0);
			});

			it('should include original payload in delivery log', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				const insertCall = (webhookDeliveryLogsRepository.insertOne as any).mock
					.calls[0][0];
				expect(insertCall.payload).toMatchObject({
					transactionId: 'txn_67890',
					projectId: 'proj_abc',
				});
			});

			it('should delete message from DLQ after successful processing', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(DeleteMessageCommand).toHaveBeenCalledWith({
					QueueUrl: mockDlqUrl,
					ReceiptHandle: 'receipt-handle-dlq-12345',
				});
			});

			it('should log error message with transaction ID', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'🚨 Permanent Failure: Transaction txn_67890 reached DLQ.',
				);
				loggerErrorSpy.mockRestore();
			});

			it('should log success message after deleting from DLQ', async () => {
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				const loggerLogSpy = vi
					.spyOn(sut['logger'], 'log')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerLogSpy).toHaveBeenCalledWith('Message deleted from DLQ');
				loggerLogSpy.mockRestore();
			});
		});

		describe('error handling', () => {
			it('should handle message without Body', async () => {
				const messageWithoutBody = {
					MessageId: 'msg-no-body',
					ReceiptHandle: 'receipt-handle-no-body',
				};
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [messageWithoutBody],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(webhookDeliveryLogsRepository.insertOne).not.toHaveBeenCalled();
			});

			it('should handle malformed JSON in message Body', async () => {
				const malformedMessage = {
					...mockMessage,
					Body: 'invalid-json-{',
				};
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [malformedMessage],
				});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'Failed to process DLQ message',
					expect.any(Error),
				);
				loggerErrorSpy.mockRestore();
			});

			it('should handle missing transactionId in message Body', async () => {
				const messageWithoutTransactionId = {
					...mockMessage,
					Body: JSON.stringify({ projectId: 'proj_abc' }),
				};
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [messageWithoutTransactionId],
					})
					.mockResolvedValue({});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'🚨 Permanent Failure: Transaction undefined reached DLQ.',
				);
				loggerErrorSpy.mockRestore();
			});

			it('should handle missing projectId in message Body', async () => {
				const messageWithoutProjectId = {
					...mockMessage,
					Body: JSON.stringify({ transactionId: 'txn_67890' }),
				};
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [messageWithoutProjectId],
					})
					.mockResolvedValue({});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalled();
				loggerErrorSpy.mockRestore();
			});

			it('should handle message without ReceiptHandle', async () => {
				const messageWithoutReceipt = {
					MessageId: 'msg-no-receipt',
					Body: JSON.stringify({
						transactionId: 'txn_67890',
						projectId: 'proj_abc',
					}),
				};
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [messageWithoutReceipt],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalled();
				expect(DeleteMessageCommand).not.toHaveBeenCalled();
			});

			it('should handle repository insertion failure', async () => {
				vi.spyOn(webhookDeliveryLogsRepository, 'insertOne').mockRejectedValue(
					new Error('Database error'),
				);
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [mockMessage],
				});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'Failed to process DLQ message',
					expect.any(Error),
				);
				loggerErrorSpy.mockRestore();
			});

			it('should handle DLQ deletion failure', async () => {
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send
					.mockResolvedValueOnce({
						Messages: [mockMessage],
					})
					.mockRejectedValueOnce(new Error('SQS deletion failed'));
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'Failed to delete message from DLQ',
					expect.any(Error),
				);
				loggerErrorSpy.mockRestore();
			});

			it('should continue polling after processing error', async () => {
				vi.spyOn(webhookDeliveryLogsRepository, 'insertOne')
					.mockRejectedValueOnce(new Error('Database error'))
					.mockResolvedValue();
				const message1 = { ...mockMessage, MessageId: 'msg-1' };
				const message2 = { ...mockMessage, MessageId: 'msg-2' };
				mockSqsClient.send
					.mockResolvedValueOnce({ Messages: [message1] })
					.mockResolvedValueOnce({})
					.mockResolvedValueOnce({ Messages: [message2] })
					.mockResolvedValue({});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				await vi.runOnlyPendingTimersAsync();
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalledTimes(
					2,
				);
			});
		});

		describe('edge cases', () => {
			it('should handle multiple messages in sequence', async () => {
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValue({});
				const message1 = {
					...mockMessage,
					MessageId: 'msg-1',
					Body: JSON.stringify({
						transactionId: 'txn_1',
						projectId: 'proj_1',
					}),
				};
				const message2 = {
					...mockMessage,
					MessageId: 'msg-2',
					Body: JSON.stringify({
						transactionId: 'txn_2',
						projectId: 'proj_2',
					}),
				};
				const message3 = {
					...mockMessage,
					MessageId: 'msg-3',
					Body: JSON.stringify({
						transactionId: 'txn_3',
						projectId: 'proj_3',
					}),
				};
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
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalledTimes(
					3,
				);
			});

			it('should handle message with complex payload', async () => {
				const complexMessage = {
					...mockMessage,
					Body: JSON.stringify({
						transactionId: 'txn_complex',
						projectId: 'proj_complex',
						metadata: {
							attempt: 5,
							lastError: 'Timeout',
							originalPayload: {
								amount: 10000,
								currency: 'BRL',
							},
						},
					}),
				};
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [complexMessage],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				const insertCall = (webhookDeliveryLogsRepository.insertOne as any).mock
					.calls[0][0];
				expect(insertCall.payload).toHaveProperty('metadata');
				expect(insertCall.payload.metadata.attempt).toBe(5);
			});

			it('should handle very long transactionId', async () => {
				const longTransactionId = 'txn_' + 'a'.repeat(100);
				const messageWithLongId = {
					...mockMessage,
					Body: JSON.stringify({
						transactionId: longTransactionId,
						projectId: 'proj_abc',
					}),
				};
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [messageWithLongId],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				const insertCall = (webhookDeliveryLogsRepository.insertOne as any).mock
					.calls[0][0];
				expect(insertCall.transactionId.toString()).toBe(longTransactionId);
			});

			it('should handle message with null values in payload', async () => {
				const messageWithNulls = {
					...mockMessage,
					Body: JSON.stringify({
						transactionId: 'txn_nulls',
						projectId: 'proj_nulls',
						optionalField: null,
					}),
				};
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [messageWithNulls],
				});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalled();
			});

			it('should handle message with empty strings', async () => {
				const messageWithEmptyStrings = {
					...mockMessage,
					Body: JSON.stringify({
						transactionId: '',
						projectId: '',
					}),
				};
				mockSqsClient.send.mockResolvedValueOnce({
					Messages: [messageWithEmptyStrings],
				});
				const loggerErrorSpy = vi
					.spyOn(sut['logger'], 'error')
					.mockImplementation(() => {});
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				// Should fail due to EntityCuid validation
				expect(loggerErrorSpy).toHaveBeenCalledWith(
					'Failed to process DLQ message',
					expect.any(Error),
				);
				loggerErrorSpy.mockRestore();
			});
		});

		describe('concurrency scenarios', () => {
			it('should process messages one at a time (MaxNumberOfMessages: 1)', async () => {
				vi.spyOn(
					webhookDeliveryLogsRepository,
					'insertOne',
				).mockResolvedValue();
				const message1 = {
					...mockMessage,
					MessageId: 'msg-concurrent-1',
					ReceiptHandle: 'receipt-1',
					Body: JSON.stringify({
						transactionId: 'txn_1',
						projectId: 'proj_1',
					}),
				};
				const message2 = {
					...mockMessage,
					MessageId: 'msg-concurrent-2',
					ReceiptHandle: 'receipt-2',
					Body: JSON.stringify({
						transactionId: 'txn_2',
						projectId: 'proj_2',
					}),
				};
				// First receive + delete, then second receive + delete
				mockSqsClient.send
					.mockResolvedValueOnce({ Messages: [message1] }) // First receive
					.mockResolvedValueOnce({}) // First delete
					.mockResolvedValueOnce({ Messages: [message2] }) // Second receive
					.mockResolvedValueOnce({}) // Second delete
					.mockResolvedValue({ Messages: [] }); // Subsequent polls
				sut.onModuleInit();
				// First poll cycle
				await vi.runOnlyPendingTimersAsync();
				const firstInsertCall = (webhookDeliveryLogsRepository.insertOne as any)
					.mock.calls[0][0];
				expect(firstInsertCall.transactionId.toString()).toBe('txn_1');
				// Second poll cycle
				await vi.runOnlyPendingTimersAsync();
				const secondInsertCall = (
					webhookDeliveryLogsRepository.insertOne as any
				).mock.calls[1][0];
				expect(secondInsertCall.transactionId.toString()).toBe('txn_2');
				// Should have processed both messages
				expect(webhookDeliveryLogsRepository.insertOne).toHaveBeenCalledTimes(
					2,
				);
			});

			it('should respect long polling WaitTimeSeconds', async () => {
				mockSqsClient.send.mockResolvedValue({ Messages: [] });
				sut.onModuleInit();
				await vi.runOnlyPendingTimersAsync();
				expect(ReceiveMessageCommand).toHaveBeenCalledWith(
					expect.objectContaining({
						WaitTimeSeconds: 20,
					}),
				);
			});
		});
	});
});
