import { TransactionEntity } from '../entities/transaction.entity';

import { IRepository } from '@/core/domain/repository';

export abstract class ITransactionsRepository extends IRepository<TransactionEntity> {
	abstract findByIdempotencyKey(
		idempotencyKey: string,
	): Promise<TransactionEntity | null>;
	abstract findByIdempotencyKeyAndProjectId(
		idempotencyKey: string,
		projectId: string,
	): Promise<TransactionEntity | null>;
	abstract findByProjectIdPaginated(
		projectId: string,
		pagination: { page: number; limit: number },
	): Promise<{ transactions: TransactionEntity[]; total: number }>;
	abstract findByExternalId(
		externalId: string,
	): Promise<TransactionEntity | null>;
	abstract findByExternalIdAndProjectId(
		externalId: string,
		projectId: string,
	): Promise<TransactionEntity | null>;
}
