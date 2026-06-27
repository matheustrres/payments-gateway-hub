import { Mocked } from 'vitest';

import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';

export function createProjectsRepositoryMock(): Mocked<IProjectsRepository> {
	return {
		existsByName: vi.fn(),
		insertOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		updateOne: vi.fn(),
		deleteOne: vi.fn(),
		findByApiKeyHash: vi.fn(),
	};
}
