import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import cuid2 from '@paralleldrive/cuid2';
import { LoggerModule } from 'nestjs-pino';

import { BackofficeModule } from './modules/backoffice/backoffice.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

import { GlobalExceptionFilter } from '@/shared/lib/exceptions/global-exception-filter';
import { DatabaseModule } from '@/shared/modules/database/database.module';
import { EnvModule } from '@/shared/modules/env/env.module';

@Module({
	imports: [
		DatabaseModule,
		EnvModule,
		BackofficeModule,
		PaymentsModule,
		WebhooksModule,
		LoggerModule.forRoot({
			pinoHttp: {
				autoLogging: false,
				base: null,
				quietResLogger: true,
				genReqId: (request: any) =>
					request?.requestContext?.requestId || cuid2.createId(),
				redact: {
					paths: ['req.headers.x-api-key'],
					censor: '***REDACTED***',
				},
				serializers: {
					err: (err) => ({
						type: err.constructor?.name,
						message: err.message,
						// stack: err.stack,
						...(err.response?.statusCode && {
							statusCode: err.response.statusCode,
						}),
					}),
					req(req) {
						return {
							id: req.id,
							method: req.method,
							url: req.url,
							remoteAddress: req.remoteAddress,
						};
					},
				},
				customProps: (req) => {
					return {
						correlationId: req.id,
					};
				},
			},
		}),
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
	],
})
export class AppModule {}
