import {
	BadRequestException,
	HttpException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { AxiosError, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { EPaymentMethod } from '@/core/enums/payment';

import {
	PaymentInput,
	PixPaymentGatewayInput,
} from '@/modules/payments/application/dtos/payment-input.dto';
import {
	IPaymentGatewayPort,
	PaymentGatewayResponse,
} from '@/modules/payments/application/ports/payment-gateway.port';

import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

@Injectable()
export class AbacatePayPaymentGatewayAdapter implements IPaymentGatewayPort {
	private readonly baseUrl = 'https://api.abacatepay.com/v1';
	private readonly logger = new Logger(AbacatePayPaymentGatewayAdapter.name);

	constructor(private readonly httpService: IHttpRequestingService) {}

	async process(input: PaymentInput): Promise<PaymentGatewayResponse> {
		try {
			const { data } = await firstValueFrom(
				this.httpService.post<AbacatePayCreateBillingOutput>(
					`${this.baseUrl}/billing/create`,
					this.buildBillingInput(input as PixPaymentGatewayInput),
					{
						headers: this.getAuthHeaders(input.apiKey),
					},
				),
			);
			if (data.error) {
				throw new BadRequestException(`AbacatePay Error: ${data.error}`);
			}
			return {
				externalId: data.data!.id,
				status: data.data!.status,
				paymentUrl: data.data!.url,
				customer: {
					email: data.data!.customer.metadata.email,
					name: data.data!.customer.metadata.name,
					taxId: data.data!.customer.metadata.taxId,
					phone: data.data!.customer.metadata.cellphone,
				},
				metadata: data.data!.metadata,
			};
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}
			this.handleError(error);
			throw error;
		}
	}

	getAuthHeaders(apiKey: string): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		};
	}

	private buildBillingInput(
		input: PixPaymentGatewayInput,
	): AbacatePayCreateBillingInput {
		if (input.paymentMethod !== EPaymentMethod.Pix) {
			throw new BadRequestException('AbacatePay only supports PIX payments.');
		}
		const pixInput = input as PixPaymentGatewayInput;
		return {
			frequency: 'ONE_TIME',
			methods: ['PIX'],
			products: [
				{
					externalId: pixInput.idempotencyKey,
					name: pixInput.productName,
					quantity: 1,
					price: pixInput.amountInCents,
				},
			],
			returnUrl: pixInput.returnUrl,
			completionUrl: pixInput.completionUrl,
			externalId: pixInput.idempotencyKey,
			...(pixInput.customer && {
				customer: {
					...pixInput.customer,
					cellphone: pixInput.customer.cellphone,
				},
			}),
		};
	}

	private handleError(error: any): void {
		if (isAxiosError(error)) {
			const axiosError = error as AxiosError;
			const responseData = axiosError.response?.data as any;
			const errorMessage =
				responseData?.error || responseData?.message || axiosError.message;
			this.logger.error('AbacatePay API Request Failed:', {
				status: axiosError.response?.status,
				data: responseData,
			});
			throw new BadRequestException(
				`AbacatePay gateway rejected: ${errorMessage}`,
			);
		}
		throw new InternalServerErrorException(
			'Unexpected error connecting to AbacatePay gateway',
		);
	}
}

type AbacatePayCreateBillingInput = {
	frequency: 'ONE_TIME' | 'MULTIPLE_PAYMENTS';
	methods: Array<'PIX'>;
	products: Array<{
		externalId: string; // Id do produto no nosso sistema
		name: string;
		quantity: number;
		/**
		 * Preço em centavos
		 * Ex: 100 = 1,00 BRL
		 */
		price: number;
		description?: string;
	}>;
	returnUrl: string;
	completionUrl: string;
	/**
	 * Id do cliente no sistema do AbacatePay
	 */
	customerId?: string;
	customer?: {
		name: string;
		cellphone: string;
		email: string;
		/**
		 * CPF ou CNPJ do cliente
		 */
		taxId: string;
	};
	allowCoupons?: boolean;
	coupons?: Array<string>;
	/**
	 * Id único do nosso sistema para rastrear a cobrança no AbacatePay
	 */
	externalId?: string;
	metadata?: Record<string, unknown>;
};

type AbacatePayCreateBillingOutput = AbacatePayResponse<{
	id: string;
	url: string;
	amount: number;
	status: string;
	devMode: boolean;
	methods: Array<string>;
	metadata: Record<string, unknown>;
	products: Array<{
		id: string;
		externalId: string;
		quantity: number;
	}>;
	frequency: string;
	nextBilling: string | null;
	customer: {
		id: string;
		metadata: {
			name: string;
			cellphone: string;
			email: string;
			taxId: string;
		};
	};
	allowCoupons: boolean;
	coupons: Array<string>;
}>;

type AbacatePayResponse<T> =
	| {
			data: T;
			error: null;
	  }
	| {
			data?: never;
			error: string;
	  };
