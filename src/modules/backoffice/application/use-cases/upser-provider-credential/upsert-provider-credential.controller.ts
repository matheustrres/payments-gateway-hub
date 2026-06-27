import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateUpsertProviderCredentialSwaggerRoute } from './upsert-provider-credential.swagger';
import { UpsertProviderCredentialsUseCase } from './upsert-provider-credential.use-case';

import { UpsertProviderCredentialBodyDto } from '../dtos/upsert-provider-credential.dto';

import { AdminAudit } from '@/modules/backoffice/infra/auth/decorators/admin-audit.decorator';

import { ParseCUIDPipe } from '@/shared/lib/pipes/transformers/parse-cuid.pipe';

@ApiTags('Backoffice - Provider Credentials')
@Controller('backoffice')
export class UpsertProviderCredentialController {
	constructor(private readonly useCase: UpsertProviderCredentialsUseCase) {}

	@Post('projects/:projectId/provider-credentials')
	@AdminAudit({
		action: 'UPDATE',
		resource: 'PROVIDER_CREDENTIAL',
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@CreateUpsertProviderCredentialSwaggerRoute()
	async handle(
		@Param('projectId', ParseCUIDPipe) projectId: string,
		@Body() body: UpsertProviderCredentialBodyDto,
	): Promise<void> {
		return this.useCase.exec({
			...body,
			projectId,
		});
	}
}
