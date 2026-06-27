import { Project } from '@prisma/client';

import { ApiKeyEnvironment } from '@/core/domain/types/api-key-pair';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';

export class ProjectMapper {
	static toDomain(raw: Project): ProjectEntity {
		return ProjectEntity.createFrom(
			raw.id,
			{
				...this.extractApiKeys(raw),
				name: raw.name,
				isActive: raw.isActive,
				webhookUrl: raw.webhookUrl,
				adminId: raw.adminId,
			},
			{
				createdAt: raw.createdAt,
				updatedAt: raw.updatedAt,
			},
		);
	}

	static toPersistence(entity: ProjectEntity): Project {
		return entity.toSummary();
	}

	/**
	 * Extrai as chaves de API do registro do banco de forma estruturada
	 */
	private static extractApiKeys(raw: Project) {
		const environments: ApiKeyEnvironment[] = ['test', 'live'];
		return environments.reduce(
			(acc, env) => ({
				...acc,
				[`${env}ApiKeyHash`]: raw[`${env}ApiKeyHash`],
				[`${env}ApiKeyPrefix`]: raw[`${env}ApiKeyPrefix`],
			}),
			{} as Pick<
				Project,
				| 'testApiKeyHash'
				| 'testApiKeyPrefix'
				| 'liveApiKeyHash'
				| 'liveApiKeyPrefix'
			>,
		);
	}
}
