import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { GetTransactionAuditSummaryUseCase } from './get-transaction-audit-summary.use-case';
import { CreateGetTransactionAuditSummarySwaggerRoute } from './get-transaction-audit.swagger';

import {
	GetTransactionAuditSummaryQueryDto,
	GetTransactionAuditSummaryUseCaseOutput,
} from '../dtos/transaction-audit-summary';

import { AdminAudit } from '@/modules/backoffice/infra/auth/decorators/admin-audit.decorator';
import {
	Admin,
	AdminPayload,
} from '@/modules/backoffice/infra/auth/decorators/admin.decorator';

@ApiTags('Backoffice - Audit')
@Controller('backoffice/audit/transactions')
export class GetTransactionAuditSummaryController {
	constructor(private readonly useCase: GetTransactionAuditSummaryUseCase) {}

	@Get(':id')
	@AdminAudit({
		action: 'READ',
		resource: 'AUDIT_LOG',
	})
	@CreateGetTransactionAuditSummarySwaggerRoute()
	async handle(
		@Admin() _admin: AdminPayload,
		@Param('id') id: string,
		@Query() query: GetTransactionAuditSummaryQueryDto,
	): Promise<GetTransactionAuditSummaryUseCaseOutput> {
		const effectiveSearchBy = query.searchBy || 'transactionId';
		return effectiveSearchBy === 'externalId'
			? this.useCase.exec({ externalId: id })
			: this.useCase.exec({ transactionId: id });
	}
}
