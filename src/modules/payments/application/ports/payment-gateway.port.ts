import { PaymentMetadata } from '@/core/types';

import { PaymentInput } from '@/modules/payments/application/dtos/payment-input.dto';

export type PaymentGatewayResponse = {
	externalId: string;
	status: string;
	paymentUrl: string;
	customer: {
		name: string;
		email: string;
		taxId: string;
		phone: string;
	};
	metadata: PaymentMetadata;
};

export abstract class IPaymentGatewayPort {
	abstract process(input: PaymentInput): Promise<PaymentGatewayResponse>;
	abstract getAuthHeaders(apiKey: string): Record<string, string>;
}
