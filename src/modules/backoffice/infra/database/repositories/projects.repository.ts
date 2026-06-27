import { Injectable } from '@nestjs/common';

import { ProjectMapper } from '../mappers/project.mapper';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlProjectsRepository implements IProjectsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.project.delete({
			where: { id },
		});
	}

	async existsByName(name: string): Promise<boolean> {
		const count = await this.dbService.project.count({
			where: { name },
		});
		return count > 0;
	}

	async findAll(): Promise<ProjectEntity[]> {
		const projects = await this.dbService.project.findMany();
		return projects.map(ProjectMapper.toDomain);
	}

	async findByApiKeyHash(hash: string): Promise<ProjectEntity | null> {
		const project = await this.dbService.project.findFirst({
			where: {
				OR: [{ testApiKeyHash: hash }, { liveApiKeyHash: hash }],
			},
		});
		return project ? ProjectMapper.toDomain(project) : null;
	}

	async findById(id: string): Promise<ProjectEntity | null> {
		const project = await this.dbService.project.findUnique({
			where: { id },
		});
		return project ? ProjectMapper.toDomain(project) : null;
	}

	async insertOne(entity: ProjectEntity): Promise<void> {
		const raw = ProjectMapper.toPersistence(entity);
		await this.dbService.project.create({
			data: raw,
		});
	}

	async updateOne(entity: ProjectEntity): Promise<void> {
		const raw = ProjectMapper.toPersistence(entity);
		await this.dbService.project.update({
			where: { id: raw.id },
			data: raw,
		});
	}
}
