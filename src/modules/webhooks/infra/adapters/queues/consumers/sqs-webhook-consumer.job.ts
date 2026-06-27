import { createHmac } from 'node:crypto';

import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs';
import {
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

import { SQS_CLIENT } from '../sqs-client.provider';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentStatus } from '@/core/enums/payment';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { WebhookDeliveryLogEntity } from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';
import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';

import { EnvService } from '@/shared/modules/env/env.service';
import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

@Injectable()
export class SqsWebhookConsumerJob implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SqsWebhookConsumerJob.name);
	private readonly queueUrl: string;

	private isPolling = false;
	private pollingTimeout: NodeJS.Timeout | null = null;

	constructor(
		@Inject(SQS_CLIENT)
		private readonly client: SQSClient,
		private readonly envService: EnvService,
		private readonly transactionsRepository: ITransactionsRepository,
		private readonly projectsRepository: IProjectsRepository,
		private readonly webhookDeliveryLogsRepository: IWebhookDeliveryLogsRepository,
		private readonly httpService: IHttpRequestingService,
	) {
		this.queueUrl = this.envService.getKeyOrThrow('AWS_SQS_QUEUE_OUTBOUND_URL');
	}

	onModuleInit(): void {
		if (this.queueUrl) {
			this.logger.log('🟢 Starting SQS Polling for Outbound Webhooks...');
			this.startPolling();
		} else {
			this.logger.warn(
				'⚠️ SQS Polling NOT started: AWS_SQS_QUEUE_OUTBOUND_URL missing.',
			);
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
					QueueUrl: this.queueUrl,
					MaxNumberOfMessages: 1,
					WaitTimeSeconds: 20,
					VisibilityTimeout: 30,
				});
				const response = await this.client.send(command);
				if (response.Messages?.length) {
					for (const message of response.Messages) {
						await this.handleMessage(message);
					}
				}
			} catch (error) {
				this.logger.error('Error polling SQS messages', error);
			} finally {
				if (this.isPolling) {
					this.pollingTimeout = setTimeout(poll, 0);
				}
			}
		};
		poll();
	}

	private async handleMessage(message: any): Promise<void> {
		const startTime = Date.now();
		const state = {
			statusCode: null as number | null,
			responseBody: null as string | null,
			errorMessage: null as string | null,
			success: false,
			transactionId: null as string | null,
			projectId: null as string | null,
			payload: null as any,
			webhookUrl: 'NOT_CONFIGURED',
		};
		try {
			const body = JSON.parse(message.Body);
			state.transactionId = body.transactionId;
			state.projectId = body.projectId;
			const { transaction, project } = await this.fetchResources(
				state.transactionId!,
				state.projectId!,
			);
			if (!transaction || !project || !project.webhookUrl) {
				state.errorMessage = !project?.webhookUrl
					? 'No webhookUrl'
					: 'Resources not found';
				this.logger.error(`${state.errorMessage}. Discarding message.`);
				await this.deleteMessage(message.ReceiptHandle);
				return;
			}
			state.webhookUrl = project.webhookUrl;
			state.payload = this.preparePayload(
				transaction,
				message.MessageId,
				body.fromStatus,
			);
			const signature = this.signPayload(
				state.payload,
				project.apiKeys.live.hash,
			);
			const response = await this.executeDispatch(
				state.webhookUrl,
				state.payload,
				signature,
				message.MessageId,
			);
			state.statusCode = response.status;
			state.responseBody = JSON.stringify(response.data);
			state.success = true;
			this.logger.log(
				`✅ Webhook delivered: Transaction: ${state.transactionId} Event: ${state.payload.eventType}`,
			);
		} catch (error: any) {
			this.handleDispatchError(error, state);
		} finally {
			const duration = Date.now() - startTime;
			await this.persistAuditLog(state, duration);
			if (state.success) await this.deleteMessage(message.ReceiptHandle);
		}
	}

	private async fetchResources(
		transactionId: string,
		projectId: string,
	): Promise<{
		transaction: TransactionEntity | null;
		project: ProjectEntity | null;
	}> {
		const [transaction, project] = await Promise.all([
			this.transactionsRepository.findById(transactionId),
			this.projectsRepository.findById(projectId),
		]);
		return { transaction, project };
	}

	private preparePayload(
		transaction: any,
		messageId: string,
		fromStatus?: EPaymentStatus,
	) {
		const eventType = this.mapStatusToEventType(
			transaction.status as EPaymentStatus,
			fromStatus,
		);
		const metadata =
			typeof transaction.paymentData === 'string'
				? JSON.parse(transaction.paymentData)
				: transaction.paymentData || {};
		return {
			eventId: messageId,
			eventType,
			timestamp: new Date().toISOString(),
			status: transaction.status,
			idempotencyKey: transaction.idempotencyKey,
			data: {
				transactionId: transaction.id.toString(),
				paymentMethod: transaction.paymentMethod,
				amount: transaction.amountInCents.toJSON(),
				provider: {
					id: transaction.externalId,
					name: transaction.provider,
					status: transaction.externalStatus,
				},
				customer: {
					email: transaction.customerEmail,
					taxId: transaction.customerTaxId,
				},
				resources: { paymentUrl: transaction.paymentUrl },
				metadata,
			},
		};
	}

	private async executeDispatch(
		url: string,
		payload: any,
		signature: string,
		messageId: string,
	): Promise<AxiosResponse> {
		this.logger.debug(`Posting webhook ${payload.eventType} to ${url}.`);
		return firstValueFrom(
			this.httpService.post(url, payload, {
				timeout: 5000,
				headers: {
					'Content-Type': 'application/json',
					'x-hub-signature': signature,
					'User-Agent': 'Hub-Payments-Webhook/1.0',
					'X-Event-Id': messageId,
				},
			}),
		);
	}

	private handleDispatchError(error: any, state: any): void {
		state.success = false;
		state.statusCode = error.response?.status || null;
		state.responseBody = error.response?.data
			? JSON.stringify(error.response.data)
			: null;
		state.errorMessage = error.message;
		this.logger.error(
			`❌ Delivery Failed for T:${state.transactionId}: ${state.errorMessage}`,
		);
	}

	private async persistAuditLog(state: any, duration: number): Promise<void> {
		if (!state.transactionId || !state.projectId) return;
		try {
			const deliveryLog = WebhookDeliveryLogEntity.createNew({
				transactionId: EntityCuid.createFrom(state.transactionId),
				projectId: EntityCuid.createFrom(state.projectId),
				eventType: state.payload?.eventType || 'UNKNOWN',
				url: state.webhookUrl,
				payload: state.payload || {},
				statusCode: state.statusCode,
				responseBody: state.responseBody?.substring(0, 10000),
				errorMessage: state.errorMessage,
				durationInMs: duration,
				success: state.success,
			});
			await this.webhookDeliveryLogsRepository.insertOne(deliveryLog);
		} catch (error) {
			this.logger.error(
				`CRITICAL: Failed to save audit log: ${(error as Error).message}`,
			);
		}
	}

	private mapStatusToEventType(
		status: EPaymentStatus,
		fromStatus?: EPaymentStatus,
	): string {
		if (
			status === EPaymentStatus.Pending &&
			fromStatus === EPaymentStatus.Paid
		) {
			return 'transaction.reverted';
		}
		const eventMap: Record<EPaymentStatus, string> = {
			[EPaymentStatus.Paid]: 'transaction.paid',
			[EPaymentStatus.Refunded]: 'transaction.refunded',
			[EPaymentStatus.Expired]: 'transaction.expired',
			[EPaymentStatus.Cancelled]: 'transaction.cancelled',
			[EPaymentStatus.Failed]: 'transaction.failed',
			[EPaymentStatus.Chargeback]: 'transaction.chargeback',
			[EPaymentStatus.Pending]: 'transaction.created',
		};
		return eventMap[status] || 'transaction.updated';
	}

	private async deleteMessage(receiptHandle: string) {
		await this.client.send(
			new DeleteMessageCommand({
				QueueUrl: this.queueUrl,
				ReceiptHandle: receiptHandle,
			}),
		);
	}

	private signPayload(payload: any, secret: string): string {
		return createHmac('sha256', secret)
			.update(JSON.stringify(payload))
			.digest('hex');
	}
}
