import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { SQS_CLIENT } from '../sqs-client.provider';

import {
	IWebhookQueueProducerPort,
	WebhookQueuePayload,
} from '@/modules/webhooks/application/ports/queue-producer.port';

import { EnvService } from '@/shared/modules/env/env.service';

@Injectable()
export class SqsWebhookProducerAdapter implements IWebhookQueueProducerPort {
	private readonly logger = new Logger(SqsWebhookProducerAdapter.name);
	private readonly queueUrl: string;

	constructor(
		@Inject(SQS_CLIENT)
		private readonly client: SQSClient,
		private readonly envService: EnvService,
	) {
		this.queueUrl = this.envService.getKeyOrThrow('AWS_SQS_QUEUE_OUTBOUND_URL');
	}

	async dispatch(payload: WebhookQueuePayload): Promise<void> {
		const command = new SendMessageCommand({
			QueueUrl: this.queueUrl,
			MessageBody: JSON.stringify(payload),
			MessageAttributes: {
				TransactionId: {
					DataType: 'String',
					StringValue: payload.transactionId,
				},
				ProjectId: {
					DataType: 'String',
					StringValue: payload.projectId,
				},
			},
		});
		try {
			const response = await this.client.send(command);
			this.logger.log(
				`🚀 [SQS] Job enqueued: Transaction ${payload.transactionId}, MessageId ${response.MessageId}`,
			);
		} catch (error) {
			this.logger.error(
				`❌ [SQS] Failed to enqueue outbound webhook: Transaction ${payload.transactionId}`,
				error instanceof Error ? error.stack : String(error),
			);
			throw error;
		}
	}
}
