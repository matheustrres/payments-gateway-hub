import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EnvService } from './env.service';
import { validateEnv } from './functions/validate';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			cache: false,
			envFilePath: ['.env', '.env.dev', '.env.test'],
			validate: (config: Record<string, unknown>) => validateEnv(config),
		}),
	],
	providers: [EnvService],
	exports: [EnvService],
})
export class EnvModule {}
