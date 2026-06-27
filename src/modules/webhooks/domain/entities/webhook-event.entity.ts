import { EWebhookEventStatus } from '../enums/webhook-event-status';

import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';
import { EPaymentProvider } from '@/core/enums/payment';
import { Optional, PaymentMetadata } from '@/core/types';

export class WebhookEventEntity extends UpdatableEntity<WebhookEventEntityProps> {
	private constructor(props: WebhookEventEntityConstructorProps) {
		super(props);
	}

	static createNew(props: WebhookEventEntityCreateProps): WebhookEventEntity {
		return new WebhookEventEntity({
			id: EntityCuid.create(),
			props: {
				...props,
				attempts: props.attempts ?? 0,
				externalEventId: props.externalEventId ?? null,
				nextRetryAt: props.nextRetryAt ?? null,
				headers: props.headers ?? null,
				transactionId: props.transactionId ?? null,
				errorMessage: props.errorMessage ?? null,
				processedAt: props.processedAt ?? null,
			},
		});
	}

	static createFrom(
		id: string,
		props: WebhookEventEntityProps,
		meta: EntityMeta,
	): WebhookEventEntity {
		return new WebhookEventEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get projectId(): EntityId {
		return this.props.projectId;
	}

	get payload(): PaymentMetadata {
		return this.props.payload;
	}

	get headers(): PaymentMetadata | null {
		return this.props.headers;
	}

	get provider(): EPaymentProvider {
		return this.props.provider;
	}

	get externalEventId(): string | null {
		return this.props.externalEventId;
	}

	get transactionId(): string | null {
		return this.props.transactionId;
	}

	get status(): EWebhookEventStatus {
		return this.props.status;
	}

	get errorMessage(): string | null {
		return this.props.errorMessage;
	}

	get attempts(): number {
		return this.props.attempts;
	}

	get nextRetryAt(): Date | null {
		return this.props.nextRetryAt;
	}

	get receivedAt(): Date {
		return this.props.receivedAt;
	}

	get processedAt(): Date | null {
		return this.props.processedAt;
	}

	addAttempt(count = 1): void {
		this.props.attempts += count;
		this.touch();
	}

	setStatus(status: EWebhookEventStatus): void {
		this.props.status = status;
		this.props.processedAt = new Date();
		this.touch();
	}

	setTransactionId(transactionId: string): void {
		this.props.transactionId = transactionId;
		this.props.processedAt = new Date();
		this.touch();
	}

	setExternalEventId(externalEventId: string): void {
		this.props.externalEventId = externalEventId;
		this.touch();
	}

	setErrorMessage(errorMessage: string): void {
		this.props.errorMessage = errorMessage;
		this.props.processedAt = new Date();
		this.touch();
	}

	setNextRetryAt(nextRetryAt: Date): void {
		this.props.nextRetryAt = nextRetryAt;
		this.touch();
	}

	markAsFailed(message: string, maxAttempts: number): void {
		this.props.attempts += 1;
		this.props.errorMessage = message;
		if (this.props.attempts >= maxAttempts) {
			this.props.status = EWebhookEventStatus.Failed;
			this.props.nextRetryAt = null;
		} else {
			const minutesToAdd = Math.pow(2, this.props.attempts); // Exponential backoff
			const nextRetryAt = new Date();
			nextRetryAt.setMinutes(nextRetryAt.getMinutes() + minutesToAdd);
			this.props.nextRetryAt = nextRetryAt;
			this.props.status = EWebhookEventStatus.Pending; // Retry posterior com o Cron
		}
	}

	toSummary(): WebhookEventSummary {
		return {
			id: this.id.toString(),
			projectId: this.props.projectId.toString(),
			provider: this.provider,
			payload: JSON.stringify(this.props.payload),
			externalEventId: this.externalEventId,
			headers: this.props.headers ? JSON.stringify(this.props.headers) : null,
			transactionId: this.transactionId,
			status: this.status,
			attempts: this.props.attempts,
			nextRetryAt: this.props.nextRetryAt,
			errorMessage: this.errorMessage,
			receivedAt: this.receivedAt,
			processedAt: this.processedAt,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}

type WebhookEventEntityConstructorProps =
	CreateEntityProps<WebhookEventEntityProps>;

type WebhookEventEntityCreateProps = Optional<
	WebhookEventEntityProps,
	| 'headers'
	| 'transactionId'
	| 'errorMessage'
	| 'processedAt'
	| 'attempts'
	| 'nextRetryAt'
	| 'externalEventId'
>;

type WebhookEventSummary = {
	id: string;
	projectId: string;
	provider: string;
	payload: string;
	externalEventId: string | null;
	headers: string | null;
	transactionId: string | null;
	status: string;
	errorMessage: string | null;
	attempts: number;
	nextRetryAt: Date | null;
	receivedAt: Date;
	processedAt: Date | null;
	createdAt: Date;
	updatedAt: Date | null;
};

export type WebhookEventEntityProps = {
	projectId: EntityId;
	provider: EPaymentProvider;
	payload: PaymentMetadata;
	headers: PaymentMetadata | null;
	externalEventId: string | null;
	transactionId: string | null;
	status: EWebhookEventStatus;
	errorMessage: string | null;
	attempts: number;
	nextRetryAt: Date | null;
	receivedAt: Date;
	processedAt: Date | null;
};
