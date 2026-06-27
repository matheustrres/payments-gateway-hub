import { Injectable } from '@nestjs/common';

import { TransactionMapper } from '../mappers/transaction.mapper';

import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlTransactionsRepository implements ITransactionsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.$transaction(async (tx) => {
			await tx.transaction.delete({
				where: { id },
			});
		});
	}

	async findAll(): Promise<TransactionEntity[]> {
		const raws = await this.dbService.transaction.findMany({
			include: { project: true },
		});
		return raws.map((r) => TransactionMapper.toDomain(r, r.project));
	}

	async findById(id: string): Promise<TransactionEntity | null> {
		const raw = await this.dbService.transaction.findUnique({
			where: { id },
			include: { project: true },
		});
		return raw ? TransactionMapper.toDomain(raw, raw.project) : null;
	}

	async findByIdempotencyKey(
		idempotencyKey: string,
	): Promise<TransactionEntity | null> {
		const raw = await this.dbService.transaction.findFirst({
			where: { idempotencyKey },
			include: { project: true },
		});
		return raw ? TransactionMapper.toDomain(raw, raw.project) : null;
	}

	async findByIdempotencyKeyAndProjectId(
		idempotencyKey: string,
		projectId: string,
	): Promise<TransactionEntity | null> {
		const raw = await this.dbService.transaction.findFirst({
			where: { idempotencyKey, projectId },
			include: { project: true },
		});
		return raw ? TransactionMapper.toDomain(raw, raw.project) : null;
	}

	async findByProjectIdPaginated(
		projectId: string,
		pagination: { page: number; limit: number },
	): Promise<{ transactions: TransactionEntity[]; total: number }> {
		const skip = (pagination.page - 1) * pagination.limit;
		const [raws, total] = await Promise.all([
			this.dbService.transaction.findMany({
				where: { projectId },
				skip,
				take: pagination.limit,
				orderBy: { createdAt: 'desc' },
				include: { project: true },
			}),
			this.dbService.transaction.count({
				where: { projectId },
			}),
		]);
		return {
			transactions: raws.map((r) => TransactionMapper.toDomain(r, r.project)),
			total,
		};
	}

	async findByExternalId(
		externalId: string,
	): Promise<TransactionEntity | null> {
		const raw = await this.dbService.transaction.findFirst({
			where: { externalId },
			include: { project: true },
		});
		return raw ? TransactionMapper.toDomain(raw, raw.project) : null;
	}

	async findByExternalIdAndProjectId(
		externalId: string,
		projectId: string,
	): Promise<TransactionEntity | null> {
		const raw = await this.dbService.transaction.findFirst({
			where: { externalId, projectId },
			include: { project: true },
		});
		return raw ? TransactionMapper.toDomain(raw, raw.project) : null;
	}

	async insertOne(entity: TransactionEntity): Promise<void> {
		const raw = TransactionMapper.toPersistence(entity);
		await this.dbService.$transaction(async (tx) => {
			await tx.transaction.create({
				data: {
					...raw,
					paymentData: JSON.stringify(raw.paymentData),
				},
			});
		});
	}

	async updateOne(entity: TransactionEntity): Promise<void> {
		const raw = TransactionMapper.toPersistence(entity);
		await this.dbService.$transaction(async (tx) => {
			await tx.transaction.update({
				where: { id: raw.id },
				data: {
					...raw,
					paymentData: JSON.stringify(raw.paymentData),
				},
			});
		});
	}
}
