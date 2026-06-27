import { AdminLoginBodyDto } from '../dtos/admin-login.dto';

import { EHttpStatusCode } from '@/core/enums/status-code';

import { SwaggerRoute } from '@/shared/docs/swagger';

export function AdminLoginSwaggerRoute() {
	return SwaggerRoute({
		operation: 'Admin login',
		body: AdminLoginBodyDto,
		responses: [
			{
				status: EHttpStatusCode.Unauthorized,
				description: 'Credenciais inválidas.',
			},
			{
				status: EHttpStatusCode.OK,
				description: 'Login realizado com sucesso.',
			},
		],
	});
}
