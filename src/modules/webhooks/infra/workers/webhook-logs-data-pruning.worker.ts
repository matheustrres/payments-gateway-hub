import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays, subYears } from 'date-fns';

import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';

@Injectable()
export class WebhookDeliveryLogsDataPruningWorker {
	private readonly logger = new Logger(
		WebhookDeliveryLogsDataPruningWorker.name,
	);
	private readonly BATCH_SIZE = 500;
	private readonly DAILY_MAX_DELETIONS_PER_RUN = 2_000;

	constructor(
		private readonly webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository,
		private readonly transactionHistoriesRepository: ITransactionHistoriesRepository,
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	async handleCron(): Promise<void> {
		this.logger.log('Starting data pruning process...');
		const results = await Promise.allSettled([
			this.pruneSuccessDeliveryLogs(),
			this.pruneErrorDeliveryLogs(),
			this.pruneTransactionHistory(),
		]);
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				this.logger.error(
					`Data pruning task ${index + 1} failed: ${result.reason}`,
				);
			}
		});
		this.logger.log('Data pruning process finished.');
	}

	private async pruneSuccessDeliveryLogs(): Promise<void> {
		const threshold = subDays(new Date(), 7); // 7 days
		const count = await this.deleteInBatches((limit) =>
			this.webhookDeliveryLogsRepository.deleteMany({
				success: true,
				createdAtThreshold: threshold,
				limit,
			}),
		);
		this.logger.log(
			`Cleaned ${count} successful delivery logs (older than 7 days).`,
		);
	}

	private async pruneErrorDeliveryLogs(): Promise<void> {
		const threshold = subDays(new Date(), 30); // 30 days
		const count = await this.deleteInBatches((limit) =>
			this.webhookDeliveryLogsRepository.deleteMany({
				success: false,
				createdAtThreshold: threshold,
				limit,
			}),
		);
		this.logger.log(
			`Cleaned ${count} failed delivery logs (older than 30 days).`,
		);
	}

	private async pruneTransactionHistory(): Promise<void> {
		const threshold = subYears(new Date(), 5); // 5 years
		const count = await this.deleteInBatches((limit) =>
			this.transactionHistoriesRepository.deleteMany({
				createdAtThreshold: threshold,
				limit,
			}),
		);
		this.logger.log(
			`Cleaned ${count} transaction history (older than 5 years).`,
		);
	}

	private async deleteInBatches(
		deleteFn: (limit: number) => Promise<number>,
	): Promise<number> {
		let totalDeleted = 0;
		while (totalDeleted < this.DAILY_MAX_DELETIONS_PER_RUN) {
			const deletedInBatch = await deleteFn(this.BATCH_SIZE);
			totalDeleted += deletedInBatch;
			if (deletedInBatch < this.BATCH_SIZE) break;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		return totalDeleted;
	}
}
