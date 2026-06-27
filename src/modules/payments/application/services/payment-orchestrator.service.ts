import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import {
	IPaymentGatewayPort,
	PaymentGatewayResponse,
} from '../ports/payment-gateway.port';

import { EPaymentMethod } from '@/core/enums/payment';

import { PaymentInput } from '@/modules/payments/application/dtos/payment-input.dto';

@Injectable()
export class PaymentOrchestratorService {
	constructor(
		@Inject('AbacatePayPaymentGatewayAdapter')
		private readonly abacatePayGateway: IPaymentGatewayPort,
		@Inject('AsaasPaymentGatewayAdapter')
		private readonly asaasGateway: IPaymentGatewayPort,
	) {}

	async processPayment(input: PaymentInput): Promise<PaymentGatewayResponse> {
		switch (input.paymentMethod) {
			case EPaymentMethod.Pix:
				return this.abacatePayGateway.process(input);
			case EPaymentMethod.Card:
			case EPaymentMethod.Boleto:
				return this.asaasGateway.process(input);
			default:
				throw new BadRequestException('Unsupported payment method');
		}
	}
}
