import {
	CreateEntityProps,
	Entity,
	EntityMeta,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';
import { PaymentMetadata } from '@/core/types';

export class TransactionHistoryEntity extends Entity<TransactionHistoryEntityProps> {
	private constructor(props: TransactionHistoryEntityConstructorProps) {
		super(props);
	}

	static createNew(
		props: TransactionHistoryEntityCreateProps,
	): TransactionHistoryEntity {
		return new TransactionHistoryEntity({
			id: EntityCuid.create(),
			props: {
				...props,
				rawStatus: props.rawStatus ?? null,
				triggerId: props.triggerId ?? null,
				metadata: props.metadata ?? null,
			},
		});
	}

	static createFrom(
		id: string,
		props: TransactionHistoryEntityProps,
		meta: EntityMeta,
	): TransactionHistoryEntity {
		return new TransactionHistoryEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get transactionId(): EntityId {
		return this.props.transactionId;
	}

	get fromStatus(): string {
		return this.props.fromStatus;
	}

	get toStatus(): string {
		return this.props.toStatus;
	}

	get rawStatus(): string | null {
		return this.props.rawStatus;
	}

	get trigger(): string {
		return this.props.trigger;
	}

	get triggerId(): string | null {
		return this.props.triggerId;
	}

	get metadata(): PaymentMetadata | null {
		return this.props.metadata;
	}

	toSummary(): TransactionHistorySummary {
		return {
			id: this.id.toString(),
			transactionId: this.props.transactionId.toString(),
			fromStatus: this.props.fromStatus,
			toStatus: this.props.toStatus,
			rawStatus: this.props.rawStatus,
			trigger: this.props.trigger,
			triggerId: this.props.triggerId,
			metadata: this.props.metadata
				? JSON.stringify(this.props.metadata)
				: null,
			createdAt: this.createdAt,
		};
	}
}

type TransactionHistoryEntityConstructorProps =
	CreateEntityProps<TransactionHistoryEntityProps>;

type TransactionHistoryEntityCreateProps = Omit<
	TransactionHistoryEntityProps,
	'rawStatus' | 'triggerId' | 'metadata'
> & {
	rawStatus?: string | null;
	triggerId?: string | null;
	metadata?: PaymentMetadata | null;
};

type TransactionHistorySummary = {
	id: string;
	transactionId: string;
	fromStatus: string;
	toStatus: string;
	rawStatus: string | null;
	trigger: string;
	triggerId: string | null;
	metadata: string | null;
	createdAt: Date;
};

export type TransactionHistoryEntityProps = {
	transactionId: EntityId;
	fromStatus: string;
	toStatus: string;
	rawStatus: string | null;
	trigger: string;
	triggerId: string | null;
	metadata: PaymentMetadata | null;
};
