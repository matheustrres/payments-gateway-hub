import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateProjectSwaggerRoute } from './create-project.swagger';
import { CreateProjectUseCase } from './create-project.use-case';

import {
	CreateProjectBodyDto,
	CreateProjectUseCaseOutput,
} from '../dtos/create-project.dto';

import { AdminAudit } from '@/modules/backoffice/infra/auth/decorators/admin-audit.decorator';
import {
	Admin,
	AdminPayload,
} from '@/modules/backoffice/infra/auth/decorators/admin.decorator';

@ApiTags('Backoffice - Projects')
@Controller('backoffice/projects')
export class CreateProjectController {
	constructor(private readonly useCase: CreateProjectUseCase) {}

	@Post()
	@AdminAudit({
		action: 'CREATE',
		resource: 'PROJECT',
	})
	@CreateProjectSwaggerRoute()
	async handle(
		@Admin() admin: AdminPayload,
		@Body() body: CreateProjectBodyDto,
	): Promise<CreateProjectUseCaseOutput> {
		return this.useCase.exec({
			...body,
			adminId: admin.sub,
		});
	}
}
