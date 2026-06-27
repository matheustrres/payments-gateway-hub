import {
	CreateEntityProps,
	Entity,
	EntityMeta,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';
import { PaymentMetadata } from '@/core/types';

export class WebhookDeliveryLogEntity extends Entity<WebhookDeliveryLogEntityProps> {
	private constructor(props: WebhookDeliveryLogEntityConstructorProps) {
		super(props);
	}

	static createNew(
		props: WebhookDeliveryLogEntityCreateProps,
	): WebhookDeliveryLogEntity {
		return new WebhookDeliveryLogEntity({
			id: EntityCuid.create(),
			props: {
				...props,
				statusCode: props.statusCode ?? null,
				responseBody: props.responseBody ?? null,
				errorMessage: props.errorMessage ?? null,
			},
		});
	}

	static createFrom(
		id: string,
		props: WebhookDeliveryLogEntityProps,
		meta: EntityMeta,
	): WebhookDeliveryLogEntity {
		return new WebhookDeliveryLogEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get transactionId(): EntityId {
		return this.props.transactionId;
	}

	get projectId(): EntityId {
		return this.props.projectId;
	}

	get eventType(): string {
		return this.props.eventType;
	}

	get url(): string {
		return this.props.url;
	}

	get payload(): PaymentMetadata {
		return this.props.payload;
	}

	get statusCode(): number | null {
		return this.props.statusCode;
	}

	get responseBody(): string | null {
		return this.props.responseBody;
	}

	get errorMessage(): string | null {
		return this.props.errorMessage;
	}

	get durationInMs(): number {
		return this.props.durationInMs;
	}

	get success(): boolean {
		return this.props.success;
	}

	toSummary(): WebhookDeliveryLogSummary {
		return {
			id: this.id.toString(),
			transactionId: this.props.transactionId.toString(),
			projectId: this.props.projectId.toString(),
			eventType: this.props.eventType,
			url: this.props.url,
			payload: JSON.stringify(this.props.payload),
			statusCode: this.props.statusCode,
			responseBody: this.props.responseBody,
			errorMessage: this.props.errorMessage,
			durationInMs: this.props.durationInMs,
			success: this.props.success,
			createdAt: this.createdAt,
		};
	}
}

type WebhookDeliveryLogEntityConstructorProps =
	CreateEntityProps<WebhookDeliveryLogEntityProps>;

type WebhookDeliveryLogEntityCreateProps = Omit<
	WebhookDeliveryLogEntityProps,
	'statusCode' | 'responseBody' | 'errorMessage'
> & {
	statusCode?: number | null;
	responseBody?: string | null;
	errorMessage?: string | null;
};

type WebhookDeliveryLogSummary = {
	id: string;
	transactionId: string;
	projectId: string;
	eventType: string;
	url: string;
	payload: string;
	statusCode: number | null;
	responseBody: string | null;
	errorMessage: string | null;
	durationInMs: number;
	success: boolean;
	createdAt: Date;
};

export type WebhookDeliveryLogEntityProps = {
	transactionId: EntityId;
	projectId: EntityId;
	eventType: string;
	url: string;
	payload: PaymentMetadata;
	statusCode: number | null;
	responseBody: string | null;
	errorMessage: string | null;
	durationInMs: number;
	success: boolean;
};
