import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

import {
	WebhookEventEntity,
	WebhookEventEntityProps,
} from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';

export class WebhookEventEntityBuilder {
	#props: WebhookEventEntityProps = {
		projectId: EntityCuid.create(),
		provider: EPaymentProvider.AbacatePay,
		payload: { event: 'payment.created', data: { id: '123' } },
		headers: { 'x-signature': 'abc123', 'content-type': 'application/json' },
		transactionId: 'transaction-id-123',
		status: EWebhookEventStatus.Pending,
		errorMessage: null,
		attempts: 0,
		nextRetryAt: null,
		receivedAt: new Date('2024-01-01T00:00:00Z'),
		processedAt: null,
	};

	constructor(props?: Partial<WebhookEventEntityProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withProjectId(projectId: string): this {
		this.#props.projectId = EntityCuid.createFrom(projectId);
		return this;
	}

	withProvider(provider: EPaymentProvider): this {
		this.#props.provider = provider;
		return this;
	}

	withPayload(payload: PaymentMetadata): this {
		this.#props.payload = payload;
		return this;
	}

	withHeaders(headers: PaymentMetadata | null): this {
		this.#props.headers = headers;
		return this;
	}

	withTransactionId(transactionId: string | null): this {
		this.#props.transactionId = transactionId;
		return this;
	}

	withStatus(status: EWebhookEventStatus): this {
		this.#props.status = status;
		return this;
	}

	withErrorMessage(errorMessage: string | null): this {
		this.#props.errorMessage = errorMessage;
		return this;
	}

	withReceivedAt(receivedAt: Date): this {
		this.#props.receivedAt = receivedAt;
		return this;
	}

	withProcessedAt(processedAt: Date | null): this {
		this.#props.processedAt = processedAt;
		return this;
	}

	withAttempts(attempts: number): this {
		this.#props.attempts = attempts;
		return this;
	}

	withNextRetryAt(nextRetryAt: Date | null): this {
		this.#props.nextRetryAt = nextRetryAt;
		return this;
	}

	build(): WebhookEventEntity {
		return WebhookEventEntity.createNew(this.#props);
	}

	buildProps(): WebhookEventEntityProps {
		return { ...this.#props };
	}
}
