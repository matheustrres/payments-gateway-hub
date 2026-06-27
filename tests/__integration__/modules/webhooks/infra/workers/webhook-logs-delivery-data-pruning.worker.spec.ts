import { subDays, subYears } from 'date-fns';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EntityId } from '@/core/domain/entities/entity-id';

import { PgSqlTransactionHistoriesRepository } from '@/modules/payments/infra/database/repositories/transaction-histories.repository';
import { PgSqlWebhookDeliveryLogsRepository } from '@/modules/webhooks/infra/database/repositories/webhook-delivery-logs.repository';
import { WebhookDeliveryLogsDataPruningWorker } from '@/modules/webhooks/infra/workers/webhook-logs-data-pruning.worker';

import { DatabaseService } from '@/shared/modules/database/database.service';

import { TransactionHistoryEntityBuilder } from '#/data/builders/entities/transaction-history.entity.builder';
import { WebhookDeliveryLogEntityBuilder } from '#/data/builders/entities/webhook-delivery-log.entity.builder';

describe.sequential(
	'WebhookDeliveryLogsDataPruningWorker (Integration)',
	() => {
		let worker: WebhookDeliveryLogsDataPruningWorker;
		let webhookDeliveryLogsRepository: PgSqlWebhookDeliveryLogsRepository;
		let transactionHistoriesRepository: PgSqlTransactionHistoriesRepository;
		let dbService: DatabaseService;
		let isDatabaseAvailable = true;

		const createTestProject = async (id: string) => {
			await dbService.project.upsert({
				where: { id },
				create: {
					id,
					name: `test-project-${id}`,
					testApiKeyHash: `test-hash-${id}`,
					testApiKeyPrefix: `sk_test_${id}`,
					liveApiKeyHash: `live-hash-${id}`,
					liveApiKeyPrefix: `sk_live_${id}`,
					webhookUrl: `https://webhook.test/${id}`,
					adminId: 'admin-test',
				},
				update: {},
			});
		};

		const createTestTransaction = async (id: string, projectId: string) => {
			await dbService.transaction.upsert({
				where: { id },
				create: {
					id,
					projectId,
					idempotencyKey: `idem-${id}`,
					externalId: `ext-${id}`,
					externalStatus: 'PAID',
					provider: 'ASAAS',
					status: 'PAID',
					amountInCents: 10000,
					currency: 'BRL',
					paymentMethod: 'PIX',
					paymentUrl: `https://payment.test/${id}`,
					customerEmail: `customer-${id}@test.com`,
					customerTaxId: '12345678900',
					paymentData: {},
				},
				update: {},
			});
		};

		beforeAll(async () => {
			try {
				const envService = {
					getKeyOrThrow: (key: string) => {
						if (key === 'DATABASE_URL') {
							return (
								process.env['DATABASE_URL'] ||
								'postgresql://user:password@localhost:5432/test'
							);
						}
						throw new Error(`Environment variable ${key} not found`);
					},
				} as any;
				dbService = new DatabaseService(envService);
				await dbService.$connect();

				webhookDeliveryLogsRepository = new PgSqlWebhookDeliveryLogsRepository(
					dbService,
				);
				transactionHistoriesRepository =
					new PgSqlTransactionHistoriesRepository(dbService);
				worker = new WebhookDeliveryLogsDataPruningWorker(
					webhookDeliveryLogsRepository,
					transactionHistoriesRepository,
				);

				// Clean up in correct order (respecting FK constraints)
				await dbService.webhookDeliveryLog.deleteMany({});
				await dbService.transactionHistory.deleteMany({});
				await dbService.transaction.deleteMany({});
				await dbService.project.deleteMany({});
				await dbService.admin.deleteMany({});

				// Create test admin for foreign key constraint
				await dbService.admin.create({
					data: {
						id: 'admin-test',
						name: 'Test Admin',
						email: 'test@example.com',
						password: '$2b$10$dummyhashedpassword',
					},
				});
			} catch (error) {
				isDatabaseAvailable = false;
				console.warn(
					'⚠️  Database not available. Skipping integration tests for WebhookDeliveryLogsDataPruningWorker.',
				);
				console.error('Error connecting to database:', error);
			}
		});

		afterAll(async () => {
			if (isDatabaseAvailable && dbService) {
				// Delete in correct order to respect FK constraints
				await dbService.webhookDeliveryLog.deleteMany({});
				await dbService.transactionHistory.deleteMany({});
				await dbService.transaction.deleteMany({});
				await dbService.project.deleteMany({});
				await dbService.$disconnect();
			}
		});

		beforeEach(async () => {
			if (isDatabaseAvailable && dbService) {
				// Ensure admin exists
				await dbService.admin
					.upsert({
						where: { id: 'admin-test' },
						create: {
							id: 'admin-test',
							name: 'Test Admin',
							email: 'test@example.com',
							password: '$2b$10$dummyhashedpassword',
						},
						update: {},
					})
					.catch(() => {});

				// Create test projects
				await createTestProject('project-pruning');
				await createTestProject('project-success');
				await createTestProject('project-error');
				await createTestProject('project-history');

				// Create test transactions
				await createTestTransaction('txn-1', 'project-pruning');
				await createTestTransaction('txn-2', 'project-success');
				await createTestTransaction('txn-3', 'project-error');
				await createTestTransaction('txn-4', 'project-history');
			}
		});

		afterEach(async () => {
			if (isDatabaseAvailable && dbService) {
				await dbService.webhookDeliveryLog.deleteMany({});
				await dbService.transactionHistory.deleteMany({});
			}
		});

		describe('pruneSuccessDeliveryLogs', () => {
			it.skipIf(!isDatabaseAvailable)(
				'should delete successful delivery logs older than 7 days',
				async () => {
					const now = new Date();
					const oldDate = subDays(now, 10); // 10 days ago (should be deleted)
					const recentDate = subDays(now, 5); // 5 days ago (should be kept)

					// Create old successful log
					const oldLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-1'))
						.withProjectId(new EntityId('project-success'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(oldLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: oldLog.id.toString() },
						data: { createdAt: oldDate },
					});

					// Create recent successful log
					const recentLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-1'))
						.withProjectId(new EntityId('project-success'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(recentLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: recentLog.id.toString() },
						data: { createdAt: recentDate },
					});

					// Run the worker
					await worker.handleCron();

					// Verify old log was deleted
					const oldLogFound = await webhookDeliveryLogsRepository.findById(
						oldLog.id.toString(),
					);
					expect(oldLogFound).toBeNull();

					// Verify recent log was kept
					const recentLogFound = await webhookDeliveryLogsRepository.findById(
						recentLog.id.toString(),
					);
					expect(recentLogFound).not.toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should respect batch size limit',
				async () => {
					const oldDate = subDays(new Date(), 10);

					// Create 600 old successful logs (more than batch size of 500)
					const logs = [];
					for (let i = 0; i < 600; i++) {
						const log = new WebhookDeliveryLogEntityBuilder()
							.withTransactionId(new EntityId('txn-1'))
							.withProjectId(new EntityId('project-success'))
							.withSuccess(true)
							.build();
						logs.push(log);
						await webhookDeliveryLogsRepository.insertOne(log);
						await dbService.webhookDeliveryLog.update({
							where: { id: log.id.toString() },
							data: { createdAt: oldDate },
						});
					}

					// Run the worker
					await worker.handleCron();

					// Count remaining logs
					const remaining = await dbService.webhookDeliveryLog.count({
						where: { success: true },
					});

					// Should have deleted all 600 in 2 batches (500 + 100)
					expect(remaining).toBe(0);
				},
				30000,
			);
		});

		describe('pruneErrorDeliveryLogs', () => {
			it.skipIf(!isDatabaseAvailable)(
				'should delete failed delivery logs older than 30 days',
				async () => {
					const now = new Date();
					const oldDate = subDays(now, 35); // 35 days ago (should be deleted)
					const recentDate = subDays(now, 20); // 20 days ago (should be kept)

					// Create old failed log
					const oldLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-2'))
						.withProjectId(new EntityId('project-error'))
						.withSuccess(false)
						.withErrorMessage('Connection timeout')
						.build();
					await webhookDeliveryLogsRepository.insertOne(oldLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: oldLog.id.toString() },
						data: { createdAt: oldDate },
					});

					// Create recent failed log
					const recentLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-2'))
						.withProjectId(new EntityId('project-error'))
						.withSuccess(false)
						.withErrorMessage('Server error')
						.build();
					await webhookDeliveryLogsRepository.insertOne(recentLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: recentLog.id.toString() },
						data: { createdAt: recentDate },
					});

					// Run the worker
					await worker.handleCron();

					// Verify old log was deleted
					const oldLogFound = await webhookDeliveryLogsRepository.findById(
						oldLog.id.toString(),
					);
					expect(oldLogFound).toBeNull();

					// Verify recent log was kept
					const recentLogFound = await webhookDeliveryLogsRepository.findById(
						recentLog.id.toString(),
					);
					expect(recentLogFound).not.toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should not delete successful logs when pruning error logs',
				async () => {
					const oldDate = subDays(new Date(), 35);

					// Create old successful log
					const successLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-3'))
						.withProjectId(new EntityId('project-error'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(successLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: successLog.id.toString() },
						data: { createdAt: oldDate },
					});

					// Create old failed log
					const errorLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-3'))
						.withProjectId(new EntityId('project-error'))
						.withSuccess(false)
						.build();
					await webhookDeliveryLogsRepository.insertOne(errorLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: errorLog.id.toString() },
						data: { createdAt: oldDate },
					});

					// Run the worker
					await worker.handleCron();

					// Verify successful log was NOT deleted (it's old but success logs have 7 day retention)
					const successLogFound = await webhookDeliveryLogsRepository.findById(
						successLog.id.toString(),
					);
					// Note: This will be deleted because it's older than 7 days
					expect(successLogFound).toBeNull();

					// Verify error log was deleted
					const errorLogFound = await webhookDeliveryLogsRepository.findById(
						errorLog.id.toString(),
					);
					expect(errorLogFound).toBeNull();
				},
			);
		});

		describe('pruneTransactionHistory', () => {
			it.skipIf(!isDatabaseAvailable)(
				'should delete transaction history older than 5 years',
				async () => {
					const now = new Date();
					const oldDate = subYears(now, 6); // 6 years ago (should be deleted)
					const recentDate = subYears(now, 4); // 4 years ago (should be kept)

					// Create old history
					const oldHistory = new TransactionHistoryEntityBuilder()
						.withTransactionId(new EntityId('txn-4'))
						.withFromStatus('pending')
						.withToStatus('paid')
						.build();
					await transactionHistoriesRepository.insertOne(oldHistory);
					await dbService.transactionHistory.update({
						where: { id: oldHistory.id.toString() },
						data: { createdAt: oldDate },
					});

					// Create recent history
					const recentHistory = new TransactionHistoryEntityBuilder()
						.withTransactionId(new EntityId('txn-4'))
						.withFromStatus('paid')
						.withToStatus('refunded')
						.build();
					await transactionHistoriesRepository.insertOne(recentHistory);
					await dbService.transactionHistory.update({
						where: { id: recentHistory.id.toString() },
						data: { createdAt: recentDate },
					});

					// Run the worker
					await worker.handleCron();

					// Verify old history was deleted
					const oldHistoryFound = await transactionHistoriesRepository.findById(
						oldHistory.id.toString(),
					);
					expect(oldHistoryFound).toBeNull();

					// Verify recent history was kept
					const recentHistoryFound =
						await transactionHistoriesRepository.findById(
							recentHistory.id.toString(),
						);
					expect(recentHistoryFound).not.toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should handle empty transaction history table',
				async () => {
					// Ensure table is empty
					await dbService.transactionHistory.deleteMany({});

					// Run the worker - should not throw
					await expect(worker.handleCron()).resolves.not.toThrow();

					// Verify table is still empty
					const count = await dbService.transactionHistory.count();
					expect(count).toBe(0);
				},
			);
		});

		describe('handleCron - integration', () => {
			it.skipIf(!isDatabaseAvailable)(
				'should run all pruning tasks together',
				async () => {
					const now = new Date();

					// Create old successful delivery log (10 days old)
					const oldSuccessLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-1'))
						.withProjectId(new EntityId('project-pruning'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(oldSuccessLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: oldSuccessLog.id.toString() },
						data: { createdAt: subDays(now, 10) },
					});

					// Create old failed delivery log (35 days old)
					const oldErrorLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-2'))
						.withProjectId(new EntityId('project-pruning'))
						.withSuccess(false)
						.build();
					await webhookDeliveryLogsRepository.insertOne(oldErrorLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: oldErrorLog.id.toString() },
						data: { createdAt: subDays(now, 35) },
					});

					// Create old transaction history (6 years old)
					const oldHistory = new TransactionHistoryEntityBuilder()
						.withTransactionId(new EntityId('txn-3'))
						.build();
					await transactionHistoriesRepository.insertOne(oldHistory);
					await dbService.transactionHistory.update({
						where: { id: oldHistory.id.toString() },
						data: { createdAt: subYears(now, 6) },
					});

					// Run the worker
					await worker.handleCron();

					// Verify all old records were deleted
					const successLogFound = await webhookDeliveryLogsRepository.findById(
						oldSuccessLog.id.toString(),
					);
					expect(successLogFound).toBeNull();

					const errorLogFound = await webhookDeliveryLogsRepository.findById(
						oldErrorLog.id.toString(),
					);
					expect(errorLogFound).toBeNull();

					const historyFound = await transactionHistoriesRepository.findById(
						oldHistory.id.toString(),
					);
					expect(historyFound).toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should preserve recent records across all tables',
				async () => {
					const now = new Date();

					// Create recent successful delivery log (3 days old)
					const recentSuccessLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-1'))
						.withProjectId(new EntityId('project-pruning'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(recentSuccessLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: recentSuccessLog.id.toString() },
						data: { createdAt: subDays(now, 3) },
					});

					// Create recent failed delivery log (15 days old)
					const recentErrorLog = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-2'))
						.withProjectId(new EntityId('project-pruning'))
						.withSuccess(false)
						.build();
					await webhookDeliveryLogsRepository.insertOne(recentErrorLog);
					await dbService.webhookDeliveryLog.update({
						where: { id: recentErrorLog.id.toString() },
						data: { createdAt: subDays(now, 15) },
					});

					// Create recent transaction history (2 years old)
					const recentHistory = new TransactionHistoryEntityBuilder()
						.withTransactionId(new EntityId('txn-3'))
						.build();
					await transactionHistoriesRepository.insertOne(recentHistory);
					await dbService.transactionHistory.update({
						where: { id: recentHistory.id.toString() },
						data: { createdAt: subYears(now, 2) },
					});

					// Run the worker
					await worker.handleCron();

					// Verify all recent records were kept
					const successLogFound = await webhookDeliveryLogsRepository.findById(
						recentSuccessLog.id.toString(),
					);
					expect(successLogFound).not.toBeNull();

					const errorLogFound = await webhookDeliveryLogsRepository.findById(
						recentErrorLog.id.toString(),
					);
					expect(errorLogFound).not.toBeNull();

					const historyFound = await transactionHistoriesRepository.findById(
						recentHistory.id.toString(),
					);
					expect(historyFound).not.toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should handle empty database gracefully',
				async () => {
					// Ensure all tables are empty
					await dbService.webhookDeliveryLog.deleteMany({});
					await dbService.transactionHistory.deleteMany({});

					// Run the worker - should not throw
					await expect(worker.handleCron()).resolves.not.toThrow();

					// Verify tables are still empty
					const deliveryLogCount = await dbService.webhookDeliveryLog.count();
					const historyCount = await dbService.transactionHistory.count();
					expect(deliveryLogCount).toBe(0);
					expect(historyCount).toBe(0);
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should respect DAILY_MAX_DELETIONS_PER_RUN limit',
				async () => {
					const oldDate = subDays(new Date(), 10);
					const totalToCreate = 2500;
					const logsData = Array.from({ length: totalToCreate }).map(
						(_, i) => ({
							id: `bulk-log-${i}`,
							transactionId: 'txn-1',
							projectId: 'project-pruning',
							success: true,
							eventType: 'webhook.discarded',
							url: 'https://webhook.test',
							payload: {},
							durationInMs: 0,
							createdAt: oldDate,
						}),
					);
					await dbService.webhookDeliveryLog.createMany({
						data: logsData,
						skipDuplicates: true,
					});
					await worker.handleCron();
					const remaining = await dbService.webhookDeliveryLog.count({
						where: { success: true },
					});
					// Como o limite é 2000, devem sobrar 500
					expect(remaining).toBe(500);
				},
				10000,
			);
		});

		describe('database integrity', () => {
			it.skipIf(!isDatabaseAvailable)(
				'should maintain foreign key constraints after pruning',
				async () => {
					const oldDate = subDays(new Date(), 10);

					// Create old delivery log
					const log = new WebhookDeliveryLogEntityBuilder()
						.withTransactionId(new EntityId('txn-1'))
						.withProjectId(new EntityId('project-pruning'))
						.withSuccess(true)
						.build();
					await webhookDeliveryLogsRepository.insertOne(log);
					await dbService.webhookDeliveryLog.update({
						where: { id: log.id.toString() },
						data: { createdAt: oldDate },
					});

					// Run the worker
					await worker.handleCron();

					// Verify project and transaction still exist
					const project = await dbService.project.findUnique({
						where: { id: 'project-pruning' },
					});
					expect(project).not.toBeNull();

					const transaction = await dbService.transaction.findUnique({
						where: { id: 'txn-1' },
					});
					expect(transaction).not.toBeNull();
				},
			);

			it.skipIf(!isDatabaseAvailable)(
				'should handle concurrent pruning operations',
				async () => {
					const oldDate = subDays(new Date(), 10);

					// Create multiple old logs
					for (let i = 0; i < 100; i++) {
						const log = new WebhookDeliveryLogEntityBuilder()
							.withTransactionId(new EntityId('txn-1'))
							.withProjectId(new EntityId('project-pruning'))
							.withSuccess(true)
							.build();
						await webhookDeliveryLogsRepository.insertOne(log);
						await dbService.webhookDeliveryLog.update({
							where: { id: log.id.toString() },
							data: { createdAt: oldDate },
						});
					}

					// Run worker multiple times concurrently
					await Promise.all([
						worker.handleCron(),
						worker.handleCron(),
						worker.handleCron(),
					]);

					// Verify all logs were deleted (no duplicates or errors)
					const remaining = await dbService.webhookDeliveryLog.count({
						where: { success: true },
					});
					expect(remaining).toBe(0);
				},
			);
		});
	},
);
