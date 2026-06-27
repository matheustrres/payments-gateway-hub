import { CreateProjectBodyDto } from '../dtos/create-project.dto';

import { EHttpStatusCode } from '@/core/enums/status-code';

import { OPEN_API_JWT_AUTH_NAME, SwaggerRoute } from '@/shared/docs/swagger';

export function CreateProjectSwaggerRoute() {
	return SwaggerRoute({
		operation: 'Create a new project',
		authName: OPEN_API_JWT_AUTH_NAME,
		body: CreateProjectBodyDto,
		responses: [
			{
				status: EHttpStatusCode.Unauthorized,
				description: 'Token JWT inválido ou ausente.',
			},
			{
				status: EHttpStatusCode.Conflict,
				description: 'O nome do projeto já está em uso.',
			},
			{
				status: EHttpStatusCode.Created,
				description: 'Projeto criado com sucesso.',
			},
		],
	});
}
