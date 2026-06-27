import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateCreateChargeSwaggerRoute } from './create-charge.swagger';
import { CreateChargeUseCase } from './create-charge.use-case';

import { ProjectSummary } from '@/modules/backoffice/domain/entities/project.entity';
import {
	CreateChargeBodyDto,
	CreateChargeUseCaseOutput,
} from '@/modules/payments/application/dtos/create-charge.dto';

import { CurrentProject } from '@/shared/auth/decorators/current-project.decorator';
import { ApiKeyAuthGuard } from '@/shared/auth/guards/api-key.guard';

@ApiTags('Payments')
@Controller('charges')
export class CreateChargeController {
	constructor(private readonly useCase: CreateChargeUseCase) {}

	@Post()
	@UseGuards(ApiKeyAuthGuard)
	@CreateCreateChargeSwaggerRoute()
	async handle(
		@CurrentProject() project: ProjectSummary,
		@Body() body: CreateChargeBodyDto,
	): Promise<CreateChargeUseCaseOutput> {
		return this.useCase.exec({
			...body,
			projectId: project.id,
		});
	}
}
