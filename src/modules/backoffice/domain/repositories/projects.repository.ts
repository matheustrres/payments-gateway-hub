import { ProjectEntity } from '../entities/project.entity';

import { IRepository } from '@/core/domain/repository';

export abstract class IProjectsRepository extends IRepository<ProjectEntity> {
	abstract existsByName(name: string): Promise<boolean>;
	abstract findByApiKeyHash(hash: string): Promise<ProjectEntity | null>;
}
