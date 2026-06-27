import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SqsWebhookProducerAdapter } from '@/modules/webhooks/infra/adapters/queues/producers/sqs-webhook-producer.adapter';

import { EnvService } from '@/shared/modules/env/env.service';

vi.mock('@aws-sdk/client-sqs', () => ({
	SQSClient: vi.fn(),
	SendMessageCommand: vi.fn(),
}));

describe(SqsWebhookProducerAdapter.name, () => {
	let sut: SqsWebhookProducerAdapter;
	let envService: EnvService;
	let mockSqsClient: {
		send: ReturnType<typeof vi.fn>;
	};

	const mockQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/queue';
	const mockRegion = 'us-east-1';
	const mockAccessKeyId = 'AKIAIOSFODNN7EXAMPLE';
	const mockSecretAccessKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

	beforeEach(() => {
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

		sut = new SqsWebhookProducerAdapter(mockSqsClient as any, envService);
	});

	describe('constructor', () => {
		it('should retrieve queue URL from environment', () => {
			expect(envService.getKeyOrThrow).toHaveBeenCalledWith(
				'AWS_SQS_QUEUE_OUTBOUND_URL',
			);
		});
	});

	describe('.dispatch', () => {
		const validPayload = {
			transactionId: 'txn_12345',
			projectId: 'proj_67890',
		};

		describe('successful dispatch', () => {
			it('should send message to SQS with correct payload', async () => {
				const mockMessageId = 'msg-12345-abcde';
				mockSqsClient.send.mockResolvedValue({ MessageId: mockMessageId });

				await sut.dispatch(validPayload);

				expect(SendMessageCommand).toHaveBeenCalledWith({
					QueueUrl: mockQueueUrl,
					MessageBody: JSON.stringify(validPayload),
					MessageAttributes: {
						TransactionId: {
							DataType: 'String',
							StringValue: validPayload.transactionId,
						},
						ProjectId: {
							DataType: 'String',
							StringValue: validPayload.projectId,
						},
					},
				});

				expect(mockSqsClient.send).toHaveBeenCalledTimes(1);
			});

			it('should include MessageAttributes with TransactionId', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await sut.dispatch(validPayload);

				const command = (SendMessageCommand as any).mock.calls[0][0];

				expect(command.MessageAttributes.TransactionId).toEqual({
					DataType: 'String',
					StringValue: 'txn_12345',
				});
			});

			it('should include MessageAttributes with ProjectId', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await sut.dispatch(validPayload);

				const command = (SendMessageCommand as any).mock.calls[0][0];

				expect(command.MessageAttributes.ProjectId).toEqual({
					DataType: 'String',
					StringValue: 'proj_67890',
				});
			});

			it('should serialize payload as JSON string in MessageBody', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await sut.dispatch(validPayload);

				const command = (SendMessageCommand as any).mock.calls[0][0];

				expect(command.MessageBody).toBe(JSON.stringify(validPayload));
				expect(() => JSON.parse(command.MessageBody)).not.toThrow();
			});

			it('should resolve without errors when send succeeds', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await expect(sut.dispatch(validPayload)).resolves.toBeUndefined();
			});

			it('should handle different transactionId formats', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const payloads = [
					{ transactionId: 'short', projectId: 'proj_1' },
					{ transactionId: 'txn_' + 'a'.repeat(100), projectId: 'proj_2' },
					{ transactionId: 'txn-with-dashes', projectId: 'proj_3' },
					{ transactionId: 'txn_with_underscores', projectId: 'proj_4' },
				];

				for (const payload of payloads) {
					await sut.dispatch(payload);
				}

				expect(mockSqsClient.send).toHaveBeenCalledTimes(payloads.length);
			});

			it('should handle different projectId formats', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const payloads = [
					{ transactionId: 'txn_1', projectId: 'short' },
					{ transactionId: 'txn_2', projectId: 'proj_' + 'b'.repeat(100) },
					{ transactionId: 'txn_3', projectId: 'proj-with-dashes' },
				];

				for (const payload of payloads) {
					await sut.dispatch(payload);
				}

				expect(mockSqsClient.send).toHaveBeenCalledTimes(payloads.length);
			});
		});

		describe('failed dispatch', () => {
			it('should throw error when SQS send fails', async () => {
				const sqsError = new Error('SQS Service Error');
				mockSqsClient.send.mockRejectedValue(sqsError);

				await expect(sut.dispatch(validPayload)).rejects.toThrow(
					'SQS Service Error',
				);
			});

			it('should throw error when network fails', async () => {
				const networkError = new Error('Network timeout');
				mockSqsClient.send.mockRejectedValue(networkError);

				await expect(sut.dispatch(validPayload)).rejects.toThrow(
					'Network timeout',
				);
			});

			it('should throw error when credentials are invalid', async () => {
				const authError = new Error('Invalid AWS credentials');
				mockSqsClient.send.mockRejectedValue(authError);

				await expect(sut.dispatch(validPayload)).rejects.toThrow(
					'Invalid AWS credentials',
				);
			});

			it('should throw error when queue does not exist', async () => {
				const queueError = new Error('AWS.SimpleQueueService.NonExistentQueue');
				mockSqsClient.send.mockRejectedValue(queueError);

				await expect(sut.dispatch(validPayload)).rejects.toThrow(
					'AWS.SimpleQueueService.NonExistentQueue',
				);
			});

			it('should throw error when access is denied', async () => {
				const accessError = new Error('Access Denied');
				mockSqsClient.send.mockRejectedValue(accessError);

				await expect(sut.dispatch(validPayload)).rejects.toThrow(
					'Access Denied',
				);
			});

			it('should propagate original error without modification', async () => {
				const customError = new Error('Custom error message');
				mockSqsClient.send.mockRejectedValue(customError);

				await expect(sut.dispatch(validPayload)).rejects.toBe(customError);
			});
		});

		describe('edge cases', () => {
			it('should handle payload with special characters', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const specialPayload = {
					transactionId: 'txn_!@#$%',
					projectId: 'proj_<>?/\\',
				};

				await sut.dispatch(specialPayload);

				const calls = (SendMessageCommand as any).mock.calls;
				const command = calls[calls.length - 1][0];
				const parsedBody = JSON.parse(command.MessageBody);

				expect(parsedBody).toEqual(specialPayload);
			});

			it('should handle payload with unicode characters', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const unicodePayload = {
					transactionId: 'txn_日本語',
					projectId: 'proj_émojis_🚀',
				};

				await sut.dispatch(unicodePayload);

				const calls = (SendMessageCommand as any).mock.calls;
				const command = calls[calls.length - 1][0];
				const parsedBody = JSON.parse(command.MessageBody);

				expect(parsedBody).toEqual(unicodePayload);
			});

			it('should handle empty string IDs', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const emptyPayload = {
					transactionId: '',
					projectId: '',
				};

				await sut.dispatch(emptyPayload);

				const calls = (SendMessageCommand as any).mock.calls;
				const command = calls[calls.length - 1][0];

				expect(command.MessageAttributes.TransactionId.StringValue).toBe('');
				expect(command.MessageAttributes.ProjectId.StringValue).toBe('');
			});

			it('should handle concurrent dispatch calls', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				const payloads = Array.from({ length: 10 }, (_, i) => ({
					transactionId: `txn_${i}`,
					projectId: `proj_${i}`,
				}));

				await Promise.all(payloads.map((payload) => sut.dispatch(payload)));

				expect(mockSqsClient.send).toHaveBeenCalledTimes(10);
			});

			it('should use the same SQS client instance for multiple dispatches', async () => {
				const initialSQSClientCalls = (SQSClient as any).mock.calls.length;

				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await sut.dispatch(validPayload);
				await sut.dispatch(validPayload);
				await sut.dispatch(validPayload);

				expect((SQSClient as any).mock.calls.length).toBe(
					initialSQSClientCalls,
				);
				expect(mockSqsClient.send).toHaveBeenCalledTimes(3);
			});

			it('should handle very long MessageId returned by SQS', async () => {
				const longMessageId = 'msg-' + 'a'.repeat(500);
				mockSqsClient.send.mockResolvedValue({ MessageId: longMessageId });

				await expect(sut.dispatch(validPayload)).resolves.toBeUndefined();
			});

			it('should handle response without MessageId', async () => {
				mockSqsClient.send.mockResolvedValue({});

				await expect(sut.dispatch(validPayload)).resolves.toBeUndefined();
			});
		});

		describe('queue URL configuration', () => {
			it('should use the queue URL from environment in all requests', async () => {
				mockSqsClient.send.mockResolvedValue({ MessageId: 'msg-123' });

				await sut.dispatch(validPayload);
				await sut.dispatch(validPayload);

				const calls = (SendMessageCommand as any).mock.calls;

				expect(calls[0][0].QueueUrl).toBe(mockQueueUrl);
				expect(calls[1][0].QueueUrl).toBe(mockQueueUrl);
			});
		});
	});
});
