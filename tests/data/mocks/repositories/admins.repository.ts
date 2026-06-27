import { Mocked } from 'vitest';

import { IAdminsRepository } from '@/modules/backoffice/domain/repositories/admins.repository';

export function createAdminsRepositoryMock(): Mocked<IAdminsRepository> {
	return {
		findByEmail: vi.fn(),
		insertOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		updateOne: vi.fn(),
		deleteOne: vi.fn(),
	};
}
