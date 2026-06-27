import { INestApplication, Type, applyDecorators } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiHeader,
	ApiHeaderOptions,
	ApiOperation,
	ApiParam,
	ApiParamOptions,
	ApiQuery,
	ApiQueryOptions,
	ApiResponse,
	ApiResponseOptions,
	DocumentBuilder,
	SwaggerModule,
} from '@nestjs/swagger';

type SwaggerOptions = {
	operation: string;
	responses?: ApiResponseOptions[];
	authName?: string | string[];
	body?: string | Type<unknown>;
	headers?: ApiHeaderOptions[];
	params?: ApiParamOptions[];
	queries?: ApiQueryOptions[];
};

export const OPEN_API_AUTH_NAME = 'api-key';
export const OPEN_API_JWT_AUTH_NAME = 'jwt';

export function SwaggerRoute({
	authName,
	operation,
	responses,
	body,
	headers,
	params,
	queries,
}: SwaggerOptions) {
	const authDecorators = authName
		? Array.isArray(authName)
			? authName.map((name) => ApiBearerAuth(name))
			: [ApiBearerAuth(authName)]
		: [];

	return applyDecorators(
		...([
			ApiOperation({ summary: operation }),
			...(responses || []).map((response) => ApiResponse({ ...response })),
			...authDecorators,
			body && ApiBody({ type: body }),
			...(queries || []).map(ApiQuery),
			...(headers || []).map(ApiHeader),
			...(params || []).map(ApiParam),
		].filter(Boolean) as MethodDecorator[]),
	);
}

export function setupSwaggerDocs(app: INestApplication): void {
	const docBuilder = new DocumentBuilder()
		.setTitle('Idip Payments Gateway Hub API')
		.addBearerAuth(
			{
				type: 'apiKey',
				in: 'header',
				name: 'x-api-key',
			},
			OPEN_API_AUTH_NAME,
		)
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
			},
			OPEN_API_JWT_AUTH_NAME,
		)
		.setVersion('1.0.0');
	const docFactory = SwaggerModule.createDocument(app, docBuilder.build());
	return SwaggerModule.setup('api', app, docFactory);
}
