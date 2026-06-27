import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

export type NormalizedWebhookEvent = {
	externalId: string;
	provider: EPaymentProvider;
	providerEventId: string;
	currentStatus: EPaymentStatus; // domain status
	rawStatus: string; // provider status
	rawEventType: string; // provider event type
	metadata: PaymentMetadata;
	createdAt?: Date | string; // provider event date
};

export abstract class IWebhookParserPort {
	abstract parse(payload: any): NormalizedWebhookEvent | null;
	abstract supports(provider: EPaymentProvider): boolean;
}
