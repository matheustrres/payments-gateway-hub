import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { AxiosError, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { EPaymentMethod, EPaymentStatus } from '@/core/enums/payment';

import {
	CreditCardPaymentGatewayInput,
	PaymentInput,
} from '@/modules/payments/application/dtos/payment-input.dto';
import {
	IPaymentGatewayPort,
	PaymentGatewayResponse,
} from '@/modules/payments/application/ports/payment-gateway.port';

import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

@Injectable()
export class AsaasPaymentGatewayAdapter implements IPaymentGatewayPort {
	private readonly logger = new Logger(AsaasPaymentGatewayAdapter.name);

	private readonly PROD_URL = 'https://api.asaas.com/v3';
	private readonly SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

	constructor(private readonly httpService: IHttpRequestingService) {}

	async process(input: PaymentInput): Promise<PaymentGatewayResponse> {
		// Validação: Asaas só suporta Boleto e Credit Card
		if (input.paymentMethod === EPaymentMethod.Pix) {
			throw new BadRequestException(
				'Asaas adapter does not support PIX payments. Use AbacatePay adapter instead.',
			);
		}
		const baseUrl = input.isSandbox ? this.SANDBOX_URL : this.PROD_URL;
		const headers = this.getAuthHeaders(input.apiKey);
		try {
			const customerId = await this.findOrCreateCustomer(baseUrl, headers, {
				cpfCnpj: input.customer.taxId,
				email: input.customer.email,
				mobilePhone: input.customer.cellphone,
				name: input.customer.name,
			});
			const paymentPayload = this.buildPaymentPayload(input, customerId);
			const { data: charge } = await firstValueFrom(
				this.httpService.post<AsaasCreateBillingOutput>(
					`${baseUrl}/payments`,
					paymentPayload,
					{ headers },
				),
			);
			if ('errors' in charge) {
				const errorMessages = charge.errors
					.map((err) => `${err.code}: ${err.description}`)
					.join('; ');
				throw new BadRequestException(`Asaas Error: ${errorMessages}`);
			}
			const extraMetadata = await this.fetchAdditionalMetadata(
				baseUrl,
				headers,
				charge.id,
				input.paymentMethod,
			);
			return {
				externalId: charge.id,
				status: this.mapAsaasStatusToDomain(charge.status),
				paymentUrl: charge.bankSlipUrl || charge.invoiceUrl || '',
				customer: {
					name: input.customer.name,
					email: input.customer.email,
					taxId: input.customer.taxId,
					phone: input.customer.cellphone,
				},
				metadata: {
					transactionReceiptUrl: charge.transactionReceiptUrl,
					nossoNumero: extraMetadata['nossoNumero'],
					...extraMetadata,
				},
			};
		} catch (error) {
			this.handleError(error);
			throw error;
		}
	}

	getAuthHeaders(apiKey: string): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			'User-Agent': 'Hub-Payments-Gateway/1.0',
			access_token: apiKey,
		};
	}

	private async findOrCreateCustomer(
		baseUrl: string,
		headers: Record<string, string>,
		customer: {
			name: string;
			cpfCnpj: string;
			email: string;
			mobilePhone: string;
		},
	): Promise<string> {
		const url = new URL(`${baseUrl}/customers`);
		url.searchParams.set('cpfCnpj', customer.cpfCnpj);
		url.searchParams.set('limit', '1');
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<{
					data: Array<{
						id: string;
						name: string;
						email: string;
						cpfCnpj: string;
						mobilePhone: string;
					}>;
				}>(url.toString(), { headers }),
			);
			if (data.data && data.data.length > 0) {
				return data.data[0]!.id;
			}
			const payload = {
				name: customer.name,
				email: customer.email,
				cpfCnpj: customer.cpfCnpj,
				mobilePhone: customer.mobilePhone,
				notificationDisabled: false,
			};
			const { data: createdCustomer } = await firstValueFrom(
				this.httpService.post<{ id: string }>(`${baseUrl}/customers`, payload, {
					headers,
				}),
			);
			return createdCustomer.id;
		} catch (error) {
			this.logger.error('Erro ao buscar/criar cliente no Asaas', error);
			throw new InternalServerErrorException(
				'Falha ao registrar cliente no gateway Asaas',
			);
		}
	}

	private buildPaymentPayload(
		input: PaymentInput,
		customerId: string,
	): AsaasCreateBillingInput {
		let dueDate = new Date(Date.now() + 3 * 86400000)
			.toISOString()
			.split('T')[0]!;
		if (
			(input.paymentMethod === EPaymentMethod.Boleto ||
				input.paymentMethod === EPaymentMethod.Card) &&
			(input as any).dueDate
		) {
			dueDate = (input as any).dueDate;
		}
		const payload: AsaasCreateBillingInput = {
			customer: customerId,
			billingType: this.mapBillingType(input.paymentMethod),
			value: input.amountInCents / 100, // Centavos -> Reais
			dueDate,
			externalReference: input.idempotencyKey,
			description: `Pedido ${input.idempotencyKey}`,
		};
		if (input.paymentMethod === EPaymentMethod.Card) {
			const cardInput = input as CreditCardPaymentGatewayInput;
			payload.creditCard = {
				holderName: cardInput.card.holderName,
				number: cardInput.card.number,
				expiryMonth: cardInput.card.expiryMonth,
				expiryYear: cardInput.card.expiryYear,
				ccv: cardInput.card.cvv,
			};
			payload.creditCardHolderInfo = {
				name: input.customer.name,
				email: input.customer.email,
				cpfCnpj: input.customer.taxId,
				postalCode: input.customer.postalCode || '00000000', // Asaas obriga
				addressNumber: input.customer.addressNumber || 'SN', // Asaas obriga
				phone: input.customer.cellphone,
			};
		}
		return payload;
	}

	private async fetchAdditionalMetadata(
		baseUrl: string,
		headers: Record<string, string>,
		paymentId: string,
		method: EPaymentMethod,
	): Promise<Record<string, any>> {
		const metadata: Record<string, any> = {};
		try {
			if (method === EPaymentMethod.Boleto) {
				const { data } = await firstValueFrom(
					this.httpService.get<{
						identificationField: string;
						barCode: string;
					}>(`${baseUrl}/payments/${paymentId}/identificationField`, {
						headers,
					}),
				);
				metadata['barCode'] = data.identificationField;
				metadata['rawBarCode'] = data.barCode;
			}
		} catch (error) {
			this.logger.warn(
				`Não foi possível buscar metadados extras para ${paymentId}. Motivo: ${
					(error as Error).message
				}`,
			);
		}
		return metadata;
	}

	private mapBillingType(method: EPaymentMethod): string {
		const map: { [key: string]: string } = {
			[EPaymentMethod.Boleto]: 'BOLETO',
			[EPaymentMethod.Card]: 'CREDIT_CARD',
		};
		return map[method] || 'BOLETO';
	}

	private mapAsaasStatusToDomain(asaasStatus: string): string {
		const map: Record<string, string> = {
			PENDING: EPaymentStatus.Pending,
			RECEIVED: EPaymentStatus.Paid,
			CONFIRMED: EPaymentStatus.Paid,
			RECEIVED_IN_CASH: EPaymentStatus.Paid,
			OVERDUE: EPaymentStatus.Failed,
			REFUNDED: EPaymentStatus.Refunded,
			REFUND_IN_PROGRESS: EPaymentStatus.Refunded,
			CHARGEBACK_REQUESTED: EPaymentStatus.Chargeback,
			CHARGEBACK_DISPUTE: EPaymentStatus.Chargeback,
		};
		return map[asaasStatus] || EPaymentStatus.Pending;
	}

	private handleError(error: any): void {
		// Se já é uma exceção do NestJS (BadRequestException, etc), não sobrescrever
		if (error instanceof BadRequestException) {
			return; // Deixa a exceção original ser lançada
		}
		if (isAxiosError(error)) {
			const axiosError = error as AxiosError;
			const responseData = axiosError.response?.data as any;
			let errorMessage = responseData?.error || axiosError.message;
			if (responseData?.errors && Array.isArray(responseData.errors)) {
				errorMessage = responseData.errors
					.map((e: any) => `${e.code}: ${e.description}`)
					.join(' | ');
			}
			this.logger.error('Asaas Gateway Error:', {
				status: axiosError.response?.status,
				message: errorMessage,
				data: responseData,
			});
			throw new BadRequestException(`Asaas Rejected: ${errorMessage}`);
		}
		this.logger.error('Unexpected Asaas Error', error);
		throw new InternalServerErrorException(
			'Erro inesperado na comunicação com o Asaas.',
		);
	}
}

type AsaasCreateBillingInput = {
	customer: string;
	billingType: string;
	value: number;
	dueDate: string | Date;
	externalReference: string;
	description?: string;
	creditCard?: {
		holderName: string;
		number: string;
		expiryMonth: string;
		expiryYear: string;
		ccv: string;
	};
	creditCardHolderInfo?: {
		name: string;
		email: string;
		cpfCnpj: string;
		postalCode: string;
		addressNumber: string;
		phone: string;
	};
};

type AsaasCreateBillingOutput = AsaasResponse<{
	id: string;
	customer: string;
	subscription: string | null;
	paymentLink: string | null;
	value: number;
	dueDate: string;
	billingType: string;
	/**
	 * PENDING RECEIVED CONFIRMED OVERDUE REFUNDED RECEIVED_IN_CASH REFUND_REQUESTED REFUND_IN_PROGRESS CHARGEBACK_REQUESTED CHARGEBACK_DISPUTE AWAITING_CHARGEBACK_REVERSAL DUNNING_REQUESTED DUNNING_RECEIVED AWAITING_RISK_ANALYSIS
	 */
	status: string;
	invoiceUrl: string | null;
	transactionReceiptUrl: string | null;
	bankSlipUrl: string | null;
}>;

type AsaasResponse<T> =
	| T
	| {
			errors: Array<{
				code: string;
				description: string;
			}>;
	  };
