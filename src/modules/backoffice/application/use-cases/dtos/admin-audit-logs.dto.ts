import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

import { AdminAuditResource } from '@/modules/backoffice/domain/types/admin-audit';

export class GetAdminAuditLogsQueryDto {
	@ApiPropertyOptional({
		description: 'ID do administrador que realizou a ação',
	})
	@IsOptional()
	@IsString()
	adminId?: string;

	@ApiPropertyOptional({
		description: 'Recurso afetado',
		example: 'PROJECT',
		enum: [
			'PROJECT',
			'TRANSACTION',
			'ADMIN',
			'PROVIDER_CREDENTIAL',
			'WEBHOOK',
			'AUDIT_LOG',
			'OTHER',
		],
	})
	@IsOptional()
	@IsString()
	resource?: AdminAuditResource;

	@ApiPropertyOptional({
		description: 'ID do recurso específico (ex: projectId)',
	})
	@IsOptional()
	@IsString()
	resourceId?: string;

	@ApiPropertyOptional({ description: 'Página atual', default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ description: 'Itens por página', default: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10)
	limit?: number = 10;
}
