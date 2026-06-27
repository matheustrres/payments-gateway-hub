import { EPaymentStatus } from '@/core/enums/payment';

export type WebhookQueuePayload = {
	transactionId: string;
	projectId: string;
	fromStatus?: EPaymentStatus;
};

export abstract class IWebhookQueueProducerPort {
	abstract dispatch(payload: WebhookQueuePayload): Promise<void>;
}
