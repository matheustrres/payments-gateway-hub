import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { SQS_CLIENT } from '../sqs-client.provider';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';

import { WebhookDeliveryLogEntity } from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';

import { EnvService } from '@/shared/modules/env/env.service';

@Injectable()
export class SqsDlqMonitorJob implements OnModuleInit {
	private readonly logger = new Logger(SqsDlqMonitorJob.name);
	private readonly dlqUrl: string;
	private isPolling = false;
	private pollingTimeout: NodeJS.Timeout | null = null;

	constructor(
		@Inject(SQS_CLIENT)
		private readonly client: SQSClient,
		private readonly envService: EnvService,
		private readonly webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository,
	) {
		this.dlqUrl = this.envService.getKeyOrThrow(
			'AWS_SQS_QUEUE_OUTBOUND_DLQ_URL',
		);
	}

	onModuleInit(): void {
		if (this.dlqUrl) {
			this.logger.log(
				'Starting SQS Polling for Dead Letter Queue (Outbound)...',
			);
			this.startPolling();
		}
	}

	onModuleDestroy(): void {
		this.isPolling = false;
		if (this.pollingTimeout) {
			clearTimeout(this.pollingTimeout);
		}
	}

	private startPolling(): void {
		this.isPolling = true;
		const poll = async () => {
			if (!this.isPolling) return;
			try {
				const command = new ReceiveMessageCommand({
					QueueUrl: this.dlqUrl,
					MaxNumberOfMessages: 1,
					WaitTimeSeconds: 20,
				});
				const response = await this.client.send(command);
				if (response.Messages?.length) {
					for (const message of response.Messages) {
						await this.handleDlqMessage(message);
					}
				}
			} catch (error) {
				this.logger.error('Error polling DLQ messages', error);
			} finally {
				if (this.isPolling) {
					this.pollingTimeout = setTimeout(poll, 1_000);
				}
			}
		};
		poll();
	}

	private async handleDlqMessage(message: any): Promise<void> {
		try {
			if (!message.Body) return;
			const body = JSON.parse(message.Body);
			const { transactionId, projectId } = body;
			this.logger.error(
				`🚨 Permanent Failure: Transaction ${transactionId} reached DLQ.`,
			);
			const deliveryLog = WebhookDeliveryLogEntity.createNew({
				transactionId: EntityCuid.createFrom(transactionId),
				projectId: EntityCuid.createFrom(projectId),
				eventType: 'webhook.discarded',
				url: 'N/A',
				payload: body,
				statusCode: null,
				success: false,
				errorMessage:
					'MAX_RETRIES_REACHED: Message moved to DLQ and discarded.',
				durationInMs: 0,
			});
			await this.webhookDeliveryLogsRepository.insertOne(deliveryLog);
			if (message.ReceiptHandle) {
				await this.deleteMessageFromDlq(message.ReceiptHandle);
			}
		} catch (error) {
			this.logger.error('Failed to process DLQ message', error);
		}
	}

	private async deleteMessageFromDlq(receiptHandle: string): Promise<void> {
		try {
			await this.client.send(
				new DeleteMessageCommand({
					QueueUrl: this.dlqUrl,
					ReceiptHandle: receiptHandle,
				}),
			);
			this.logger.log('Message deleted from DLQ');
		} catch (error) {
			this.logger.error('Failed to delete message from DLQ', error);
		}
	}
}
