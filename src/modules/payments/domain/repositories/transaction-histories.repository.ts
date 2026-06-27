import { TransactionHistoryEntity } from '../entities/transaction-history.entity';

import { IRepository } from '@/core/domain/repository';

export type DeleteManyOptions = {
	createdAtThreshold?: Date;
	limit?: number;
};

export abstract class ITransactionHistoriesRepository extends IRepository<TransactionHistoryEntity> {
	abstract findManyByTransactionId(
		transactionId: string,
	): Promise<TransactionHistoryEntity[]>;
	abstract deleteMany(options?: DeleteManyOptions): Promise<number>;
}
