import { EntityId } from '@/core/domain/entities/entity-id';
import { PaymentMetadata } from '@/core/types';

import {
	WebhookDeliveryLogEntity,
	WebhookDeliveryLogEntityProps,
} from '@/modules/webhooks/domain/entities/webhook-delivery-log.entity';

export class WebhookDeliveryLogEntityBuilder {
	#props: WebhookDeliveryLogEntityProps = {
		transactionId: new EntityId('cl9v1x5f20000qzrmn5g6z5v3'),
		projectId: new EntityId('cl9v1x5f20000qzrmn5g6z5v4'),
		eventType: 'payment.paid',
		url: 'https://example.com/webhook',
		payload: {
			transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
			status: 'paid',
			amount: 10000,
		},
		statusCode: 200,
		responseBody: '{"success":true}',
		errorMessage: null,
		durationInMs: 150,
		success: true,
	};

	constructor(props?: Partial<WebhookDeliveryLogEntityProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withTransactionId(transactionId: EntityId): this {
		this.#props.transactionId = transactionId;
		return this;
	}

	withProjectId(projectId: EntityId): this {
		this.#props.projectId = projectId;
		return this;
	}

	withEventType(eventType: string): this {
		this.#props.eventType = eventType;
		return this;
	}

	withUrl(url: string): this {
		this.#props.url = url;
		return this;
	}

	withPayload(payload: PaymentMetadata): this {
		this.#props.payload = payload;
		return this;
	}

	withStatusCode(statusCode: number | null): this {
		this.#props.statusCode = statusCode;
		return this;
	}

	withResponseBody(responseBody: string | null): this {
		this.#props.responseBody = responseBody;
		return this;
	}

	withErrorMessage(errorMessage: string | null): this {
		this.#props.errorMessage = errorMessage;
		return this;
	}

	withDurationInMs(durationInMs: number): this {
		this.#props.durationInMs = durationInMs;
		return this;
	}

	withSuccess(success: boolean): this {
		this.#props.success = success;
		return this;
	}

	build(): WebhookDeliveryLogEntity {
		return WebhookDeliveryLogEntity.createNew(this.#props);
	}

	buildProps(): WebhookDeliveryLogEntityProps {
		return { ...this.#props };
	}
}
