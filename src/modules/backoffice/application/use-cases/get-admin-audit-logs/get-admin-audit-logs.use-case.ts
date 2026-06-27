import { Injectable } from '@nestjs/common';

import {
	GetAdminAuditLogsInput,
	GetAdminAuditLogsOutput,
} from './get-admin-audit-logs.controller';

import { IUseCase } from '@/core/use-case';

import { IAdminAuditsRepository } from '@/modules/backoffice/domain/repositories/admin-audits.repository';

import { PaginationHelper } from '@/shared/utils/pagination';

@Injectable()
export class GetAdminAuditLogsUseCase implements IUseCase<
	GetAdminAuditLogsInput,
	GetAdminAuditLogsOutput
> {
	constructor(private readonly adminAuditsRepository: IAdminAuditsRepository) {}

	async exec(input: GetAdminAuditLogsInput): Promise<GetAdminAuditLogsOutput> {
		const page = input.page ?? 1;
		const limit = input.limit ?? 10;
		const { items, total } = await this.adminAuditsRepository.findManyPaginated(
			{
				adminId: input.adminId,
				resource: input.resource,
				resourceId: input.resourceId,
				page,
				limit,
			},
		);
		return {
			data: items.map((audit) => ({
				id: audit.id.toString(),
				admin: {
					id: audit.admin.id.toString(),
					name: audit.admin.name,
					email: audit.admin.email,
				},
				action: audit.action,
				resource: audit.resource,
				resourceId: audit.resourceId,
				oldData: audit.oldData,
				newData: audit.newData,
				ipAddress: audit.ipAddress,
				createdAt: audit.createdAt,
			})),
			pagination: PaginationHelper.buildPaginationMeta(page, limit, total),
		};
	}
}
