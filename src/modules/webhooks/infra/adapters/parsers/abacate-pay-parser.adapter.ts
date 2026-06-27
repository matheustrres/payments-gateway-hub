import { Injectable, Logger } from '@nestjs/common';

import { EPaymentProvider, EPaymentStatus } from '@/core/enums/payment';

import {
	IWebhookParserPort,
	NormalizedWebhookEvent,
} from '@/modules/webhooks/application/ports/webhook-parser.port';

@Injectable()
export class AbacatePayWebhookParser implements IWebhookParserPort {
	private readonly logger = new Logger(AbacatePayWebhookParser.name);

	parse(payload: AbacatePayWebhookPayload): NormalizedWebhookEvent | null {
		const eventType = payload.event;
		const rootData = payload['data'];
		if (!eventType || !rootData) {
			this.logger.warn('Parser Ignored: Missing eventType or data');
			return null;
		}
		// Somente atualização de cobranças
		if (!eventType.startsWith('billing.')) {
			this.logger.debug(
				`Parser Ignored: Event type ${eventType} not supported`,
			);
			return null;
		}
		const billingStatus = rootData.billing.status;
		const statusFromEvent = this.mapStatusFromEvent(eventType);
		return {
			externalId: rootData.billing.id,
			provider: EPaymentProvider.AbacatePay,
			providerEventId: payload.id,
			currentStatus: statusFromEvent ?? this.mapStatus(billingStatus),
			rawEventType: eventType,
			rawStatus: billingStatus,
			metadata: rootData.payment,
		};
	}

	supports(provider: EPaymentProvider): boolean {
		return provider === EPaymentProvider.AbacatePay;
	}

	private mapStatusFromEvent(eventType: string): EPaymentStatus | null {
		switch (eventType) {
			case 'billing.paid':
				return EPaymentStatus.Paid;
			case 'billing.refunded':
				return EPaymentStatus.Refunded;
			case 'billing.expired':
				return EPaymentStatus.Expired;
			case 'billing.failed':
				return EPaymentStatus.Failed;
			case 'billing.created':
			case 'billing.pending':
				return EPaymentStatus.Pending;
			default:
				return null;
		}
	}

	private mapStatus(status: string): EPaymentStatus {
		if (!status) return EPaymentStatus.Pending;
		switch (status.toUpperCase()) {
			case 'PAID':
				return EPaymentStatus.Paid;
			case 'REFUNDED':
				return EPaymentStatus.Refunded;
			case 'EXPIRED':
				return EPaymentStatus.Expired;
			case 'FAILED':
				return EPaymentStatus.Failed;
			case 'PENDING':
				return EPaymentStatus.Pending;
			default:
				return EPaymentStatus.Pending;
		}
	}
}

export type AbacatePayWebhookBillingPayload = {
	id: string;
	amount: number;
	frequency: string;
	status: string;
	paidAmount: number;
	couponsUsed: string[];
};

export type AbacatePayWebhookPaymentPayload = {
	amount: number;
	fee: number;
	method: string;
};

export type AbacatePayWebhookPayload = {
	id: string;
	event: string;
	data: {
		billing: AbacatePayWebhookBillingPayload;
		payment: AbacatePayWebhookPaymentPayload;
	};
};
