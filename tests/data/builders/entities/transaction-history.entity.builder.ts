import { EntityId } from '@/core/domain/entities/entity-id';
import { PaymentMetadata } from '@/core/types';

import {
	TransactionHistoryEntity,
	TransactionHistoryEntityProps,
} from '@/modules/payments/domain/entities/transaction-history.entity';

export class TransactionHistoryEntityBuilder {
	#props: TransactionHistoryEntityProps = {
		transactionId: new EntityId('cl9v1x5f20000qzrmn5g6z5v3'),
		fromStatus: 'pending',
		toStatus: 'paid',
		rawStatus: 'PAID',
		trigger: 'webhook',
		triggerId: 'webhook-event-123',
		metadata: {
			provider: 'asaas',
			externalId: 'ext-123',
		},
	};

	constructor(props?: Partial<TransactionHistoryEntityProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withTransactionId(transactionId: EntityId): this {
		this.#props.transactionId = transactionId;
		return this;
	}

	withFromStatus(fromStatus: string): this {
		this.#props.fromStatus = fromStatus;
		return this;
	}

	withToStatus(toStatus: string): this {
		this.#props.toStatus = toStatus;
		return this;
	}

	withRawStatus(rawStatus: string | null): this {
		this.#props.rawStatus = rawStatus;
		return this;
	}

	withTrigger(trigger: string): this {
		this.#props.trigger = trigger;
		return this;
	}

	withTriggerId(triggerId: string | null): this {
		this.#props.triggerId = triggerId;
		return this;
	}

	withMetadata(metadata: PaymentMetadata | null): this {
		this.#props.metadata = metadata;
		return this;
	}

	build(): TransactionHistoryEntity {
		return TransactionHistoryEntity.createNew(this.#props);
	}

	buildProps(): TransactionHistoryEntityProps {
		return { ...this.#props };
	}
}
