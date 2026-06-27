import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateGetAdminAuditLogsSwaggerRoute } from './get-admin-audit-logs.swagger';
import { GetAdminAuditLogsUseCase } from './get-admin-audit-logs.use-case';

import { GetAdminAuditLogsQueryDto } from '../dtos/admin-audit-logs.dto';

import { AdminAuditResource } from '@/modules/backoffice/domain/types/admin-audit';
import { AdminAudit } from '@/modules/backoffice/infra/auth/decorators/admin-audit.decorator';

import { PaginatedResponse } from '@/shared/utils/pagination';

export type GetAdminAuditLogsInput = {
	adminId?: string;
	resource?: AdminAuditResource;
	resourceId?: string;
	page?: number;
	limit?: number;
};

export type GetAdminAuditLogsOutput = PaginatedResponse<{
	id: string;
	action: string;
	resource: string;
	resourceId: string;
	oldData: any;
	newData: any;
	ipAddress: string;
	createdAt: Date;
	admin: {
		id: string;
		name: string;
		email: string;
	};
}>;

@ApiTags('Backoffice - Audit')
@Controller('backoffice/audit-logs')
export class GetAdminAuditLogsController {
	constructor(private readonly useCase: GetAdminAuditLogsUseCase) {}

	@Get()
	@AdminAudit({
		action: 'READ',
		resource: 'AUDIT_LOG',
	})
	@CreateGetAdminAuditLogsSwaggerRoute()
	async handle(@Query() query: GetAdminAuditLogsQueryDto) {
		return this.useCase.exec({
			adminId: query.adminId,
			resource: query.resource,
			resourceId: query.resourceId,
			page: Number(query.page),
			limit: Number(query.limit),
		});
	}
}
