import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { FindChargesSwaggerRoute } from './find-charges.swagger';
import { FindChargesUseCase } from './find-charges.use-case';

import { ProjectSummary } from '@/modules/backoffice/domain/entities/project.entity';
import {
	FindChargesQueryDto,
	FindChargesUseCaseOutput,
} from '@/modules/payments/application/dtos/find-charges.dto';

import { CurrentProject } from '@/shared/auth/decorators/current-project.decorator';
import { FlexibleAuthGuard } from '@/shared/auth/guards/flexible-auth.guard';

@ApiTags('Payments')
@Controller('charges')
export class FindChargesController {
	constructor(private readonly useCase: FindChargesUseCase) {}

	@Get()
	@UseGuards(FlexibleAuthGuard)
	@FindChargesSwaggerRoute()
	async handle(
		@Query() query: FindChargesQueryDto,
		@CurrentProject() project?: ProjectSummary,
	): Promise<FindChargesUseCaseOutput> {
		const authType = project ? 'project' : 'admin';
		return this.useCase.exec({
			idempotencyKey: query.idempotencyKey,
			projectId: query.projectId,
			page: query.page ?? 1,
			limit: query.limit ?? 20,
			authType,
			authenticatedProjectId: project?.id,
		});
	}
}
