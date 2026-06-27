import { subDays, subYears } from 'date-fns';

import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';
import { WebhookDeliveryLogsDataPruningWorker } from '@/modules/webhooks/infra/workers/webhook-logs-data-pruning.worker';

import { createTransactionHistoriesRepositoryMock } from '#/data/mocks/repositories/transaction-histories.repository';
import { createWebhookDeliveryLogsRepositoryMock } from '#/data/mocks/repositories/webhook-delivery-logs.repository';

describe(WebhookDeliveryLogsDataPruningWorker.name, () => {
	let sut: WebhookDeliveryLogsDataPruningWorker;
	let webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository;
	let transactionHistoriesRepository: ITransactionHistoriesRepository;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-13T10:00:00Z'));
		webhookDeliveryLogsRepository = createWebhookDeliveryLogsRepositoryMock();
		transactionHistoriesRepository = createTransactionHistoriesRepositoryMock();
		sut = new WebhookDeliveryLogsDataPruningWorker(
			webhookDeliveryLogsRepository,
			transactionHistoriesRepository,
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('handleCron', () => {
		it('should start and finish data pruning process', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Starting data pruning process...',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Data pruning process finished.',
			);
			loggerLogSpy.mockRestore();
		});

		it('should call all pruning methods', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			await sut.handleCron();
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledTimes(2);
			expect(transactionHistoriesRepository.deleteMany).toHaveBeenCalledTimes(
				1,
			);
		});

		it('should handle errors in pruning tasks gracefully', async () => {
			const error = new Error('Database error');
			vi.spyOn(
				webhookDeliveryLogsRepository,
				'deleteMany',
			).mockRejectedValueOnce(error);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Data pruning task 1 failed'),
			);
			loggerErrorSpy.mockRestore();
		});

		it('should continue processing other tasks if one fails', async () => {
			const error = new Error('Failed to prune success logs');
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockRejectedValueOnce(error) // pruneSuccessDeliveryLogs fails
				.mockResolvedValueOnce(50); // pruneErrorDeliveryLogs succeeds
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				100,
			);
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledTimes(2);
			expect(transactionHistoriesRepository.deleteMany).toHaveBeenCalledTimes(
				1,
			);
			expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
			loggerErrorSpy.mockRestore();
		});
	});

	describe('pruneSuccessDeliveryLogs', () => {
		it('should delete successful delivery logs older than 7 days', async () => {
			const now = new Date('2026-01-13T10:00:00Z');
			const threshold = subDays(now, 7);
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				100,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			await sut.handleCron();
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledWith({
				success: true,
				createdAtThreshold: threshold,
				limit: 500,
			});
		});

		it('should log the number of cleaned successful delivery logs', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				150,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 150 successful delivery logs (older than 7 days).',
			);
			loggerLogSpy.mockRestore();
		});

		it('should process in batches until less than BATCH_SIZE is deleted', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(500) // First batch: full
				.mockResolvedValueOnce(500) // Second batch: full
				.mockResolvedValueOnce(300) // Third batch: partial (stops here)
				.mockResolvedValue(0);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// First call is for success logs (3 batches), second is for error logs (1 batch)
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledTimes(4);
		});

		it('should respect DAILY_MAX_DELETIONS_PER_RUN limit', async () => {
			// Mock to always return full batches
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				500,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				500,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// Should stop at 2000 (DAILY_MAX_DELETIONS_PER_RUN)
			// 2000 / 500 = 4 batches per task
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 2000 successful delivery logs (older than 7 days).',
			);
			loggerLogSpy.mockRestore();
		});
	});

	describe('pruneErrorDeliveryLogs', () => {
		it('should delete failed delivery logs older than 30 days', async () => {
			const now = new Date('2026-01-13T10:00:00Z');
			const threshold = subDays(now, 30);
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(0) // success logs
				.mockResolvedValueOnce(75); // error logs
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			await sut.handleCron();
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenNthCalledWith(
				2,
				{
					success: false,
					createdAtThreshold: threshold,
					limit: 500,
				},
			);
		});

		it('should log the number of cleaned failed delivery logs', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(0) // success logs
				.mockResolvedValueOnce(250); // error logs
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 250 failed delivery logs (older than 30 days).',
			);
			loggerLogSpy.mockRestore();
		});

		it('should process in batches for error logs', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(0) // success logs
				.mockResolvedValueOnce(500) // error logs batch 1
				.mockResolvedValueOnce(500) // error logs batch 2
				.mockResolvedValueOnce(200); // error logs batch 3 (partial)
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// 1 for success + 3 for error logs + 1 for transaction histories
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledTimes(4);
		});
	});

	describe('pruneTransactionHistory', () => {
		it('should delete transaction history older than 5 years', async () => {
			const now = new Date('2026-01-13T10:00:00Z');
			const threshold = subYears(now, 5);
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				50,
			);
			await sut.handleCron();
			expect(transactionHistoriesRepository.deleteMany).toHaveBeenCalledWith({
				createdAtThreshold: threshold,
				limit: 500,
			});
		});

		it('should log the number of cleaned transaction histories', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				300,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 300 transaction history (older than 5 years).',
			);
			loggerLogSpy.mockRestore();
		});

		it('should process in batches for transaction histories', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany')
				.mockResolvedValueOnce(500) // batch 1
				.mockResolvedValueOnce(500) // batch 2
				.mockResolvedValueOnce(500) // batch 3
				.mockResolvedValueOnce(400); // batch 4 (partial)
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			expect(transactionHistoriesRepository.deleteMany).toHaveBeenCalledTimes(
				4,
			);
		});
	});

	describe('deleteInBatches', () => {
		it('should stop when deleted count is less than BATCH_SIZE', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(500)
				.mockResolvedValueOnce(300) // Less than BATCH_SIZE, should stop
				.mockResolvedValue(0);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// Should call deleteMany for success logs only twice
			expect(webhookDeliveryLogsRepository.deleteMany).toHaveBeenCalledTimes(3); // 2 for success + 1 for error
		});

		it('should stop when DAILY_MAX_DELETIONS_PER_RUN is reached', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				500,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// Each task should delete max 2000 records
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 2000 successful delivery logs (older than 7 days).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 2000 failed delivery logs (older than 30 days).',
			);
			loggerLogSpy.mockRestore();
		});

		it('should add delay between batches', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(500)
				.mockResolvedValueOnce(500)
				.mockResolvedValueOnce(100)
				.mockResolvedValue(0);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			// Should have delays between batches (at least 2 for the success logs)
			expect(setTimeoutSpy).toHaveBeenCalled();
			setTimeoutSpy.mockRestore();
		});

		it('should return total deleted count', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(500)
				.mockResolvedValueOnce(0)
				.mockResolvedValue(0);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			const promise = sut.handleCron();
			await vi.runAllTimersAsync();
			await promise;
			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'successful delivery logs (older than 7 days).',
				),
			);
			loggerLogSpy.mockRestore();
		});
	});

	describe('integration scenarios', () => {
		it('should handle all tasks completing successfully', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockResolvedValueOnce(100) // success logs
				.mockResolvedValueOnce(50); // error logs
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				75,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Starting data pruning process...',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 100 successful delivery logs (older than 7 days).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 50 failed delivery logs (older than 30 days).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 75 transaction history (older than 5 years).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Data pruning process finished.',
			);
			loggerLogSpy.mockRestore();
		});

		it('should handle no records to delete', async () => {
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			vi.spyOn(transactionHistoriesRepository, 'deleteMany').mockResolvedValue(
				0,
			);
			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 0 successful delivery logs (older than 7 days).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 0 failed delivery logs (older than 30 days).',
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				'Cleaned 0 transaction history (older than 5 years).',
			);
			loggerLogSpy.mockRestore();
		});

		it('should handle multiple tasks failing', async () => {
			const error1 = new Error('Failed to delete success logs');
			const error2 = new Error('Failed to delete transaction history');
			vi.spyOn(webhookDeliveryLogsRepository, 'deleteMany')
				.mockRejectedValueOnce(error1) // success logs fail
				.mockResolvedValueOnce(50); // error logs succeed
			vi.spyOn(
				transactionHistoriesRepository,
				'deleteMany',
			).mockRejectedValueOnce(error2); // transaction history fails
			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});
			await sut.handleCron();
			expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Data pruning task 1 failed'),
			);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Data pruning task 3 failed'),
			);
			loggerErrorSpy.mockRestore();
		});
	});
});
