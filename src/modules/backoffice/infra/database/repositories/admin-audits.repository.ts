import { Injectable } from '@nestjs/common';

import { AdminAuditMapper } from '../mappers/admin-audit.mapper';

import { AdminAuditEntity } from '@/modules/backoffice/domain/entities/admin-audit';
import {
	FindManyPaginatedParams,
	IAdminAuditsRepository,
} from '@/modules/backoffice/domain/repositories/admin-audits.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlAdminAuditsRepository implements IAdminAuditsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async findManyPaginated(
		params: FindManyPaginatedParams,
	): Promise<{ items: AdminAuditEntity[]; total: number }> {
		const where = {
			adminId: params.adminId,
			resource: params.resource,
			resourceId: params.resourceId,
		};
		const [items, total] = await Promise.all([
			this.dbService.adminAudit.findMany({
				where,
				include: { admin: true }, // Join essencial
				orderBy: { createdAt: 'desc' },
				skip: (params.page - 1) * params.limit,
				take: params.limit,
			}),
			this.dbService.adminAudit.count({ where }),
		]);
		const mappedItems = items.map((item) =>
			AdminAuditMapper.toDomain(item, item.admin),
		);
		return { items: mappedItems, total };
	}
}
