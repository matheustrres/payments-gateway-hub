import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { EnvSchema } from '@/shared/modules/env/env.schema';

export function validateEnv(config: Record<string, unknown>): EnvSchema {
	const validatedConfig = plainToInstance(EnvSchema, config, {
		enableImplicitConversion: true,
	});

	const errors = validateSync(validatedConfig, {
		skipMissingProperties: false,
	});

	if (errors.length > 0) {
		throw new Error(errors.toString());
	}

	return validatedConfig;
}
