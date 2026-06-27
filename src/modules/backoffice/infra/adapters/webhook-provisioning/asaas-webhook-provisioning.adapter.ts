import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { AxiosError, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { EPaymentProvider } from '@/core/enums/payment';

import {
	IWebhookProvisioningPort,
	ProvisionWebhookInput,
	ProvisionWebhookOutput,
} from '@/modules/backoffice/application/ports/webhook-provisioning.port';

import { EnvService } from '@/shared/modules/env/env.service';
import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

@Injectable()
export class AsaasWebhookProvisioningAdapter implements IWebhookProvisioningPort {
	private readonly logger = new Logger(AsaasWebhookProvisioningAdapter.name);

	private readonly PROD_URL = 'https://api.asaas.com/v3';
	private readonly SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

	constructor(
		private readonly httpService: IHttpRequestingService,
		private readonly envService: EnvService,
	) {}

	supports(provider: EPaymentProvider): boolean {
		return provider === EPaymentProvider.Asaas;
	}

	async provision(
		input: ProvisionWebhookInput,
	): Promise<ProvisionWebhookOutput> {
		const baseUrl = input.isSandbox ? this.SANDBOX_URL : this.PROD_URL;
		const headers = this.getAuthHeaders(input.apiKey);
		const baseAppUrl = this.envService.getKey('BASE_URL');
		const webhookUrl = `${baseAppUrl}/webhooks/inbound/${input.projectId}/asaas`;
		try {
			const payload: AsaasCreateWebhookPayload = {
				name: `Payment Hub - Project ${input.projectId}`,
				url: webhookUrl,
				email: this.envService.getKey('ADMIN_EMAIL'),
				enabled: true,
				interrupted: false,
				authToken: input.webhookSecret ?? null,
				sendType: 'SEQUENTIALLY',
				events: [
					'PAYMENT_CONFIRMED',
					'PAYMENT_RECEIVED',
					'PAYMENT_OVERDUE',
					'PAYMENT_REFUNDED',
					'PAYMENT_DELETED',
					'PAYMENT_CHARGEBACK_REQUESTED',
					'PAYMENT_RECEIVED_IN_CASH_UNDONE',
				],
			};
			const { data: webhook } = await firstValueFrom(
				this.httpService.post<AsaasCreateWebhookResponse>(
					`${baseUrl}/webhooks`,
					payload,
					{ headers },
				),
			);
			if ('errors' in webhook) {
				const errorMessages = webhook.errors
					.map((err) => `${err.code}: ${err.description}`)
					.join('; ');
				throw new BadRequestException(
					`Asaas Webhook Creation Error: ${errorMessages}`,
				);
			}
			this.logger.log(
				`Webhook created successfully for project ${input.projectId} at Asaas. Webhook ID: ${webhook.id}`,
			);
			return {
				webhookId: webhook.id,
				webhookUrl: webhook.url,
			};
		} catch (error) {
			this.handleError(error, input.projectId);
			throw error;
		}
	}

	private getAuthHeaders(apiKey: string): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			'User-Agent': 'Hub-Payments-Gateway/1.0',
			access_token: apiKey,
		};
	}

	private handleError(error: any, projectId: string): void {
		if (error instanceof BadRequestException) return;
		if (isAxiosError(error)) {
			const axiosError = error as AxiosError;
			const responseData = axiosError.response?.data as any;
			let errorMessage = responseData?.error || axiosError.message;
			if (responseData?.errors && Array.isArray(responseData.errors)) {
				errorMessage = responseData.errors
					.map((e: any) => `${e.code}: ${e.description}`)
					.join(' | ');
			}
			this.logger.error('Asaas Webhook Provisioning Error:', {
				projectId,
				status: axiosError.response?.status,
				message: errorMessage,
				data: responseData,
			});
			throw new BadRequestException(
				`Provisionamento do webhook no Asaas falhou: ${errorMessage}`,
			);
		}
		this.logger.error(
			`Unexpected error provisioning Asaas webhook for project ${projectId}`,
			error,
		);
		throw new InternalServerErrorException(
			'Erro inesperado ao provisionar webhook no Asaas.',
		);
	}
}

type AsaasCreateWebhookPayload = {
	name: string;
	url: string;
	email: string;
	enabled: boolean;
	interrupted: boolean;
	authToken: string | null;
	sendType: 'SEQUENTIALLY' | 'NON_SEQUENTIALLY';
	events: string[];
};

type AsaasCreateWebhookResponse =
	| {
			id: string;
			name: string;
			url: string;
			email: string;
			enabled: boolean;
			interrupted: boolean;
			authToken: string | null;
			sendType: string;
			apiVersion: number;
			type: string;
	  }
	| {
			errors: Array<{
				code: string;
				description: string;
			}>;
	  };
