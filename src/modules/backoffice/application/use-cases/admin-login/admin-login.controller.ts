import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminLoginSwaggerRoute } from './admin-login.swagger';
import { AdminLoginUseCase } from './admin-login.use-case';

import {
	AdminLoginBodyDto,
	AdminLoginUseCaseOutput,
} from '../dtos/admin-login.dto';

import { AdminAudit } from '@/modules/backoffice/infra/auth/decorators/admin-audit.decorator';

import { Public } from '@/shared/auth/decorators/public.decorator';

@ApiTags('Backoffice - Auth')
@Controller('backoffice/auth')
export class AdminLoginController {
	constructor(private readonly useCase: AdminLoginUseCase) {}

	@Post('login')
	@AdminAudit({
		action: 'LOGIN',
		resource: 'ADMIN',
	})
	@Public()
	@AdminLoginSwaggerRoute()
	async handle(
		@Body() body: AdminLoginBodyDto,
	): Promise<AdminLoginUseCaseOutput> {
		return this.useCase.exec(body);
	}
}
