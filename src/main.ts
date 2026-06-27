import './shared/module-alias';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';

import { AppModule } from '@/app.module';

import { ENodeEnv } from '@/core/enums/node-env';

import { setupSwaggerDocs } from '@/shared/docs/swagger';
import { EnvService } from '@/shared/modules/env/env.service';

enum ExitStatusEnum {
	FAILURE = 1,
	SUCCESS = 0,
}

enum ExitMessageEnum {
	FAILURE = 'App exited with an error:',
	SUCCESS = 'App exited successfully',
	UNCAUGHT_EXCEPTION = 'App exited due to an uncaught exception:',
	UNHANDLED_REJECTION = 'App exited due to an unhandled rejection:',
}

function exitWithSuccess(): never {
	console.log(ExitMessageEnum.SUCCESS);
	process.exit(ExitStatusEnum.SUCCESS);
}

function exitWithFailure(message?: string, error?: unknown): never {
	console.error(message, error);
	process.exit(ExitStatusEnum.FAILURE);
}

process.on('uncaughtException', (error: Error): never =>
	exitWithFailure(ExitMessageEnum.UNCAUGHT_EXCEPTION, error),
);

process.on('unhandledRejection', (reason: unknown) => {
	exitWithFailure(ExitMessageEnum.UNHANDLED_REJECTION, reason);
});

(async () => {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bodyParser: false,
	});
	const logger = app.get(Logger);
	app.useLogger(logger);
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);
	app.use(
		json({
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
	app.use(
		urlencoded({
			extended: true,
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);

	const envService = app.get(EnvService);
	const appPort = envService.getKeyOrThrow('PORT');

	const logMessages: string[] = [];

	if (envService.getKeyOrThrow('NODE_ENV') !== ENodeEnv.Production) {
		setupSwaggerDocs(app);
		logMessages.push(`API client available at http://localhost:${appPort}/api`);
	}

	await app.listen(appPort).then(() => {
		logger.debug(`HTTP server running on port ${appPort}.`);
		if (logMessages.length) {
			logMessages.forEach((msg) => logger.debug(msg));
		}
	});

	const exitSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

	for (const signal of exitSignals) {
		process.on(signal, async () => {
			try {
				await app.close();
				exitWithSuccess();
			} catch (error) {
				exitWithFailure(ExitMessageEnum.FAILURE, error);
			}
		});
	}
})();
