import { Mocked } from 'vitest';

import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';

export function createTransactionHistoriesRepositoryMock(): Mocked<ITransactionHistoriesRepository> {
	return {
		findManyByTransactionId: vi.fn(),
		insertOne: vi.fn(),
		updateOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		deleteOne: vi.fn(),
		deleteMany: vi.fn(),
	};
}
