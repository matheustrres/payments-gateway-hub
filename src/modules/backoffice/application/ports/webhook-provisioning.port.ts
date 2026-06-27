import { EPaymentProvider } from '@/core/enums/payment';

export type ProvisionWebhookInput = {
	apiKey: string;
	projectId: string;
	isSandbox: boolean;
	webhookSecret?: string;
};

export type ProvisionWebhookOutput = {
	webhookId: string;
	webhookUrl: string;
};

export abstract class IWebhookProvisioningPort {
	abstract provision(
		input: ProvisionWebhookInput,
	): Promise<ProvisionWebhookOutput>;
	abstract supports(provider: EPaymentProvider): boolean;
}
