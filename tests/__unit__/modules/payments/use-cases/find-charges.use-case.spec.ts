import { BadRequestException, NotFoundException } from '@nestjs/common';

import { FindChargesUseCase } from '@/modules/payments/application/use-cases/find-charges/find-charges.use-case';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';

import { errorMessages } from '@/shared/utils/err-messages';

import { createTransactionsRepositoryMock } from '#/data/mocks/repositories/transactions.repository';

describe(FindChargesUseCase.name, () => {
	let useCase: FindChargesUseCase;
	let repository: ITransactionsRepository;

	beforeEach(() => {
		repository = createTransactionsRepositoryMock();
		useCase = new FindChargesUseCase(repository);
	});

	describe('Search by idempotencyKey with API Key', () => {
		it('should find charge and filter by authenticated project', async () => {
			const mockTransaction = {
				id: { identifier: 'tx-123' },
				props: { project: {}, paymentData: null },
			} as unknown as TransactionEntity;
			vi.spyOn(
				repository,
				'findByIdempotencyKeyAndProjectId',
			).mockResolvedValue(mockTransaction);
			const result = await useCase.exec({
				idempotencyKey: 'key-123',
				page: 1,
				limit: 20,
				authType: 'project',
				authenticatedProjectId: 'proj-123',
			});
			expect(repository.findByIdempotencyKeyAndProjectId).toHaveBeenCalledWith(
				'key-123',
				'proj-123',
			);
			expect(result).toEqual({
				charges: [{ id: 'tx-123', paymentData: null }],
				total: 1,
				page: 1,
				limit: 1,
				hasMore: false,
			});
		});

		it('should throw NotFoundException when charge not found', async () => {
			vi.spyOn(
				repository,
				'findByIdempotencyKeyAndProjectId',
			).mockResolvedValue(null);
			await expect(
				useCase.exec({
					idempotencyKey: 'key-123',
					page: 1,
					limit: 20,
					authType: 'project',
					authenticatedProjectId: 'proj-123',
				}),
			).rejects.toThrow(
				new NotFoundException(errorMessages.transactions.notFound),
			);
		});
	});

	describe('Search by idempotencyKey with Admin', () => {
		it('should find charge globally without project filter', async () => {
			const mockTransaction = {
				id: { identifier: 'tx-123' },
				props: { project: {}, paymentData: null },
			} as unknown as TransactionEntity;
			vi.spyOn(repository, 'findByIdempotencyKey').mockResolvedValue(
				mockTransaction,
			);
			const result = await useCase.exec({
				idempotencyKey: 'key-123',
				page: 1,
				limit: 20,
				authType: 'admin',
			});
			expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('key-123');
			expect(result.charges).toEqual([{ id: 'tx-123', paymentData: null }]);
		});

		it('should filter by projectId when admin provides it', async () => {
			const mockTransaction = {
				id: { identifier: 'tx-123' },
				props: { project: {}, paymentData: null },
			} as unknown as TransactionEntity;
			vi.spyOn(
				repository,
				'findByIdempotencyKeyAndProjectId',
			).mockResolvedValue(mockTransaction);
			await useCase.exec({
				idempotencyKey: 'key-123',
				projectId: 'proj-456',
				page: 1,
				limit: 20,
				authType: 'admin',
			});
			expect(repository.findByIdempotencyKeyAndProjectId).toHaveBeenCalledWith(
				'key-123',
				'proj-456',
			);
		});
	});

	describe('Search by projectId', () => {
		it('should return paginated results for API Key', async () => {
			const mockTransactions = [
				{
					id: { identifier: 'tx-1' },
					props: { project: {}, paymentData: null },
				},
				{
					id: { identifier: 'tx-2' },
					props: { project: {}, paymentData: null },
				},
			] as unknown as TransactionEntity[];
			vi.spyOn(repository, 'findByProjectIdPaginated').mockResolvedValue({
				transactions: mockTransactions,
				total: 42,
			});
			const result = await useCase.exec({
				projectId: 'proj-123',
				page: 2,
				limit: 20,
				authType: 'project',
				authenticatedProjectId: 'proj-123',
			});
			expect(repository.findByProjectIdPaginated).toHaveBeenCalledWith(
				'proj-123',
				{ page: 2, limit: 20 },
			);
			expect(result).toEqual({
				charges: [
					{ id: 'tx-1', paymentData: null },
					{ id: 'tx-2', paymentData: null },
				],
				total: 42,
				page: 2,
				limit: 20,
				hasMore: true,
			});
		});

		it('should force authenticated projectId for API Key', async () => {
			vi.spyOn(repository, 'findByProjectIdPaginated').mockResolvedValue({
				transactions: [],
				total: 0,
			});
			await useCase.exec({
				projectId: 'other-project',
				page: 1,
				limit: 20,
				authType: 'project',
				authenticatedProjectId: 'proj-123',
			});
			expect(repository.findByProjectIdPaginated).toHaveBeenCalledWith(
				'proj-123',
				{ page: 1, limit: 20 },
			);
		});

		it('should allow admin to query any projectId', async () => {
			vi.spyOn(repository, 'findByProjectIdPaginated').mockResolvedValue({
				transactions: [],
				total: 0,
			});
			await useCase.exec({
				projectId: 'any-project',
				page: 1,
				limit: 20,
				authType: 'admin',
			});
			expect(repository.findByProjectIdPaginated).toHaveBeenCalledWith(
				'any-project',
				{ page: 1, limit: 20 },
			);
		});

		it('should calculate hasMore correctly', async () => {
			vi.spyOn(repository, 'findByProjectIdPaginated').mockResolvedValue({
				transactions: [],
				total: 25,
			});
			const result = await useCase.exec({
				projectId: 'proj-123',
				page: 1,
				limit: 20,
				authType: 'project',
				authenticatedProjectId: 'proj-123',
			});
			expect(result.hasMore).toBe(true);
		});

		it('should throw BadRequestException when admin searches without projectId', async () => {
			await expect(
				useCase.exec({
					page: 1,
					limit: 20,
					authType: 'admin',
				}),
			).rejects.toThrow(
				new BadRequestException(
					errorMessages.projects.effectiveProjectIdRequired,
				),
			);
		});
	});
});
