import { Injectable, Logger } from '@nestjs/common';

import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

import {
	IWebhookParserPort,
	NormalizedWebhookEvent,
} from '@/modules/webhooks/application/ports/webhook-parser.port';

@Injectable()
export class AsaasWebhookParser implements IWebhookParserPort {
	private readonly logger = new Logger(AsaasWebhookParser.name);

	private readonly SUPPORTED_EVENTS = [
		'PAYMENT_CONFIRMED',
		'PAYMENT_RECEIVED',
		'PAYMENT_OVERDUE',
		'PAYMENT_REFUNDED',
		'PAYMENT_DELETED',
		'PAYMENT_CHARGEBACK_REQUESTED',
		'PAYMENT_RECEIVED_IN_CASH_UNDONE',
	];

	parse(payload: AsaasWebhookPayload): NormalizedWebhookEvent | null {
		const eventType = payload.event;
		const payment = payload.payment;
		if (!eventType || !payment) {
			this.logger.warn('Parser ignored: Missing event type or payment payload');
			return null;
		}
		if (!this.SUPPORTED_EVENTS.includes(eventType)) {
			this.logger.debug(`Parser ignored: Event ${eventType} not supported`);
			return null;
		}
		return {
			externalId: payment.id,
			provider: EPaymentProvider.Asaas,
			providerEventId: payload.id,
			currentStatus: this.mapStatusToDomain(eventType),
			rawStatus: payment.status,
			rawEventType: eventType,
			metadata: this.buildEventMetadata(eventType, payment),
			createdAt: payload.dateCreated,
		};
	}

	supports(provider: EPaymentProvider): boolean {
		return provider === EPaymentProvider.Asaas;
	}

	private mapStatusToDomain(eventType: string): EPaymentStatus {
		switch (eventType) {
			case 'PAYMENT_CONFIRMED':
			case 'PAYMENT_RECEIVED':
				return EPaymentStatus.Paid;
			case 'PAYMENT_OVERDUE':
				return EPaymentStatus.Expired;
			case 'PAYMENT_REFUNDED':
				return EPaymentStatus.Refunded;
			case 'PAYMENT_DELETED':
				return EPaymentStatus.Cancelled;
			case 'PAYMENT_CHARGEBACK_REQUESTED':
				return EPaymentStatus.Chargeback;
			case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
				return EPaymentStatus.Pending;
			default:
				return EPaymentStatus.Pending;
		}
	}

	private buildEventMetadata(eventType: string, payment: any): PaymentMetadata {
		const common = {
			billingType: payment.billingType,
			invoiceUrl: payment.invoiceUrl,
		};
		switch (eventType) {
			case 'PAYMENT_CONFIRMED':
			case 'PAYMENT_RECEIVED':
				return {
					...common,
					netValue: payment.netValue,
					confirmedDate: payment.confirmedDate,
					paymentDate: payment.paymentDate || payment.clientPaymentDate,
					transactionReceiptUrl: payment.transactionReceiptUrl,
					...(payment.billingType === 'CREDIT_CARD' && {
						creditCard: payment.creditCard,
					}),
					...(payment.billingType === 'BOLETO' && {
						bankSlipUrl: payment.bankSlipUrl,
						nossoNumero: payment.nossoNumero,
					}),
				};
			case 'PAYMENT_REFUNDED':
				return {
					...common,
					refunds: payment.refunds,
					value: payment.value,
					netValue: payment.netValue,
					transactionReceiptUrl: payment.transactionReceiptUrl,
				};
			case 'PAYMENT_OVERDUE':
				return {
					...common,
					netValue: payment.netValue,
					dueDate: payment.dueDate,
					originalDueDate: payment.originalDueDate,
					canBePaidAfterDueDate: payment.canBePaidAfterDueDate,
					fine: payment.fine,
					interest: payment.interest,
					...(payment.billingType === 'BOLETO' && {
						bankSlipUrl: payment.bankSlipUrl,
						nossoNumero: payment.nossoNumero,
					}),
				};
			case 'PAYMENT_CHARGEBACK_REQUESTED':
				return {
					...common,
					chargeback: {
						id: payment.chargeback?.id,
						status: payment.chargeback?.status,
						reason: payment.chargeback?.reason,
						isDisputable: payment.chargeback?.disputable,
					},
				};
			case 'PAYMENT_DELETED':
				return {
					...common,
					deletedAt: new Date().toISOString(),
					transactionReceiptUrl: payment.transactionReceiptUrl,
				};
			case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
				return {
					...common,
					value: payment.value,
					netValue: payment.netValue,
					dueDate: payment.dueDate,
					originalDueDate: payment.originalDueDate,
				};
			default:
				return common;
		}
	}
}

export type AsaasWebhookPaymentPayload = {
	id: string;
	status: string;
	billingType: string;
	value: number;
	netValue: number;
	invoiceUrl: string;
	bankSlipUrl?: string;
	externalReference?: string;
	creditCard?: {
		creditCardNumber: string;
		creditCardBrand: string;
	};
};

export type AsaasWebhookPayload = {
	id: string;
	event: string;
	dateCreated: string;
	payment: AsaasWebhookPaymentPayload;
};
