import { Mocked } from 'vitest';

import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';

export function createProvidersCredentialsRepositoryMock(): Mocked<IProvidersCredentialsRepository> {
	return {
		findByProjectIdAndProvider: vi.fn(),
		insertOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		updateOne: vi.fn(),
		deleteOne: vi.fn(),
	};
}
