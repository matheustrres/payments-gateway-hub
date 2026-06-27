import { Injectable } from '@nestjs/common';

import { TransactionHistoryMapper } from '../mappers/transaction-history.mapper';

import { TransactionHistoryEntity } from '@/modules/payments/domain/entities/transaction-history.entity';
import {
	DeleteManyOptions,
	ITransactionHistoriesRepository,
} from '@/modules/payments/domain/repositories/transaction-histories.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlTransactionHistoriesRepository implements ITransactionHistoriesRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.transactionHistory.delete({
			where: { id },
		});
	}

	async deleteMany(options?: DeleteManyOptions): Promise<number> {
		const records = await this.dbService.transactionHistory.findMany({
			where: {
				createdAt: { lt: options?.createdAtThreshold },
			},
			select: { id: true },
			take: options?.limit,
		});
		if (!records.length) return 0;
		const ids = records.map((r) => r.id);
		const { count } = await this.dbService.transactionHistory.deleteMany({
			where: {
				id: { in: ids },
			},
		});
		return count;
	}

	async findAll(): Promise<TransactionHistoryEntity[]> {
		const records = await this.dbService.transactionHistory.findMany({
			orderBy: {
				createdAt: 'desc',
			},
		});
		if (!records.length) return [];
		return records.map(TransactionHistoryMapper.toDomain);
	}

	async findById(id: string): Promise<TransactionHistoryEntity | null> {
		const record = await this.dbService.transactionHistory.findUnique({
			where: { id },
		});
		if (!record) return null;
		return TransactionHistoryMapper.toDomain(record);
	}

	async findManyByTransactionId(
		transactionId: string,
	): Promise<TransactionHistoryEntity[]> {
		const records = await this.dbService.transactionHistory.findMany({
			where: { transactionId },
			orderBy: {
				createdAt: 'asc',
			},
		});
		return records.map(TransactionHistoryMapper.toDomain);
	}

	async insertOne(entity: TransactionHistoryEntity): Promise<void> {
		const record = TransactionHistoryMapper.toPersistence(entity);
		await this.dbService.transactionHistory.create({
			data: {
				...record,
				metadata: record.metadata
					? JSON.parse(record.metadata as string)
					: null,
			},
		});
	}

	async updateOne(entity: TransactionHistoryEntity): Promise<void> {
		const record = TransactionHistoryMapper.toPersistence(entity);
		await this.dbService.transactionHistory.update({
			where: { id: record.id },
			data: {
				...record,
				metadata: record.metadata
					? JSON.parse(record.metadata as string)
					: null,
			},
		});
	}
}
