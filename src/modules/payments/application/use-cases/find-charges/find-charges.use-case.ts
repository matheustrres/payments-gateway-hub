import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';

import { IUseCase } from '@/core/use-case';

import {
	FindChargesUseCaseInput,
	FindChargesUseCaseOutput,
} from '@/modules/payments/application/dtos/find-charges.dto';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';

import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class FindChargesUseCase implements IUseCase<
	FindChargesUseCaseInput,
	FindChargesUseCaseOutput
> {
	constructor(
		private readonly transactionsRepository: ITransactionsRepository,
	) {}

	async exec(
		input: FindChargesUseCaseInput,
	): Promise<FindChargesUseCaseOutput> {
		const {
			idempotencyKey,
			projectId,
			page,
			limit,
			authType,
			authenticatedProjectId,
		} = input;
		const effectiveProjectId =
			authType === 'project' ? authenticatedProjectId : projectId;
		if (idempotencyKey) {
			const transaction = await this.fetchTransaction(
				idempotencyKey,
				effectiveProjectId,
			);
			if (!transaction) {
				throw new NotFoundException(errorMessages.transactions.notFound);
			}
			return {
				charges: [this.normalizeTransaction(transaction)],
				total: 1,
				page: 1,
				limit: 1,
				hasMore: false,
			};
		}
		if (!effectiveProjectId) {
			throw new BadRequestException(
				errorMessages.projects.effectiveProjectIdRequired,
			);
		}
		const { transactions, total } =
			await this.transactionsRepository.findByProjectIdPaginated(
				effectiveProjectId,
				{ page, limit },
			);
		return {
			charges: transactions.map((t) => this.normalizeTransaction(t)),
			total,
			page,
			limit,
			hasMore: total > page * limit,
		};
	}

	private async fetchTransaction(
		idempotencyKey: string,
		projectId?: string,
	): Promise<TransactionEntity | null> {
		return projectId
			? await this.transactionsRepository.findByIdempotencyKeyAndProjectId(
					idempotencyKey,
					projectId,
				)
			: await this.transactionsRepository.findByIdempotencyKey(idempotencyKey);
	}

	private normalizeTransaction(transaction: TransactionEntity) {
		const entity = transaction as any;
		const { project, paymentData, ...props } = entity.props;
		return {
			id: entity.id.identifier,
			...props,
			paymentData: paymentData ? JSON.parse(paymentData) : null,
		};
	}
}
