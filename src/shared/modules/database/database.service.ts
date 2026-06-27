import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { EnvService } from '../env/env.service';

@Injectable()
export class DatabaseService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(readonly envService: EnvService) {
		const pool = new PrismaPg({
			connectionString: envService.getKeyOrThrow('DATABASE_URL'),
		});
		super({ adapter: pool });
	}

	async onModuleInit(): Promise<void> {
		return this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		return this.$disconnect();
	}
}
