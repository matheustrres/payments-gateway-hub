import { EHttpStatusCode } from '@/core/enums/status-code';

import { FindChargesUseCaseOutput } from '@/modules/payments/application/dtos/find-charges.dto';

import {
	OPEN_API_AUTH_NAME,
	OPEN_API_JWT_AUTH_NAME,
	SwaggerRoute,
} from '@/shared/docs/swagger';

export function FindChargesSwaggerRoute() {
	return SwaggerRoute({
		operation: 'Find charges by idempotency key or project ID',
		authName: [OPEN_API_AUTH_NAME, OPEN_API_JWT_AUTH_NAME],
		responses: [
			{
				status: EHttpStatusCode.OK,
				description: 'Charges found successfully',
				type: FindChargesUseCaseOutput,
			},
			{
				status: EHttpStatusCode.BadRequest,
				description: 'Invalid query parameters',
			},
			{
				status: EHttpStatusCode.Unauthorized,
				description: 'Missing or invalid authentication',
			},
			{
				status: EHttpStatusCode.NotFound,
				description: 'Charge not found (when searching by idempotencyKey)',
			},
		],
	});
}
