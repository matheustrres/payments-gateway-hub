import { Mocked } from 'vitest';

import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';

export function createTransactionsRepositoryMock(): Mocked<ITransactionsRepository> {
	return {
		findByIdempotencyKey: vi.fn(),
		findByIdempotencyKeyAndProjectId: vi.fn(),
		findByProjectIdPaginated: vi.fn(),
		findByExternalId: vi.fn(),
		findByExternalIdAndProjectId: vi.fn(),
		insertOne: vi.fn(),
		updateOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		deleteOne: vi.fn(),
	};
}
