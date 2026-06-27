import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvSchema } from './env.schema';

@Injectable()
export class EnvService {
	constructor(private readonly configService: ConfigService<EnvSchema, true>) {}

	getKey<T extends keyof EnvSchema>(key: T) {
		return this.configService.get<EnvSchema>(key, { infer: true });
	}

	getKeyOrThrow<T extends keyof EnvSchema>(key: T) {
		return this.configService.getOrThrow(key, {
			infer: true,
		});
	}

	setKey<T extends keyof EnvSchema>(key: T, value: any): void {
		this.configService.set(key, value);
	}
}
