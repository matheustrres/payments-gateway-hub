import { ConflictException, Injectable } from '@nestjs/common';

import {
	CreateProjectUseCaseInput,
	CreateProjectUseCaseOutput,
} from '../dtos/create-project.dto';

import { IUseCase } from '@/core/use-case';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { ApiKeyGenService } from '@/modules/backoffice/domain/services/api-key-gen.service';

import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class CreateProjectUseCase implements IUseCase<
	CreateProjectUseCaseInput,
	CreateProjectUseCaseOutput
> {
	constructor(private readonly projectsRepository: IProjectsRepository) {}

	async exec(
		input: CreateProjectUseCaseInput,
	): Promise<CreateProjectUseCaseOutput> {
		const projectNameAlreadyTaken = await this.projectsRepository.existsByName(
			input.name,
		);
		if (projectNameAlreadyTaken) {
			throw new ConflictException(errorMessages.projects.nameAlreadyTaken);
		}

		const keys = {
			test: ApiKeyGenService.generate('test'),
			live: ApiKeyGenService.generate('live'),
		};

		const project = ProjectEntity.createNew({
			...input,
			isActive: true,
			testApiKeyHash: keys.test.hashStr,
			testApiKeyPrefix: keys.test.prefixStr,
			liveApiKeyHash: keys.live.hashStr,
			liveApiKeyPrefix: keys.live.prefixStr,
		});

		await this.projectsRepository.insertOne(project);

		return {
			project: {
				id: project.id.toString(),
				name: project.name,
				isActive: project.isActive,
				testApiKey: keys.test.plainStr,
				liveApiKey: keys.live.plainStr,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
			},
		};
	}
}
