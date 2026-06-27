import { TransactionHistory } from '@prisma/client';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { PaymentMetadata } from '@/core/types';

import { TransactionHistoryEntity } from '@/modules/payments/domain/entities/transaction-history.entity';

export class TransactionHistoryMapper {
	static toDomain(raw: TransactionHistory): TransactionHistoryEntity {
		return TransactionHistoryEntity.createFrom(
			raw.id,
			{
				transactionId: EntityCuid.createFrom(raw.transactionId),
				fromStatus: raw.fromStatus,
				toStatus: raw.toStatus,
				rawStatus: raw.rawStatus,
				trigger: raw.trigger,
				triggerId: raw.triggerId,
				metadata: raw.metadata ? (raw.metadata as PaymentMetadata) : null,
			},
			{
				createdAt: raw.createdAt,
			},
		);
	}

	static toPersistence(entity: TransactionHistoryEntity): TransactionHistory {
		return entity.toSummary();
	}
}
