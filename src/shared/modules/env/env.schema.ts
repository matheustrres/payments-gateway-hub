import { Transform } from 'class-transformer';
import {
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';

import { ENodeEnv } from '@/core/enums/node-env';

export class EnvSchema {
	@IsEnum(ENodeEnv)
	@IsNotEmpty()
	NODE_ENV?: ENodeEnv;

	@IsNumber()
	@IsOptional()
	@Transform(({ value }) => parseInt(value))
	PORT = 3000;

	@IsString()
	@IsNotEmpty()
	PG_USER!: string;

	@IsString()
	@IsNotEmpty()
	PG_PASSWORD!: string;

	@IsString()
	@IsNotEmpty()
	PG_HOST = 'localhost';

	@IsNumber()
	@IsNotEmpty()
	@Transform(({ value }) => parseInt(value))
	PG_PORT = 5432;

	@IsString()
	@IsNotEmpty()
	PG_DATABASE!: string;

	@IsString()
	@IsNotEmpty()
	DATABASE_URL!: string;

	@IsString()
	@IsNotEmpty()
	ABACATEPAY_API_KEY!: string;

	@IsString()
	@IsNotEmpty()
	ENCRYPTION_MASTER_KEY!: string;

	@IsString()
	@IsNotEmpty()
	AWS_SQS_QUEUE_OUTBOUND_URL!: string;

	@IsString()
	@IsNotEmpty()
	AWS_SQS_QUEUE_OUTBOUND_DLQ_URL!: string;

	@IsString()
	@IsNotEmpty()
	AWS_REGION!: string;

	@IsString()
	@IsNotEmpty()
	AWS_ACCESS_KEY_ID!: string;

	@IsString()
	@IsNotEmpty()
	AWS_SECRET_ACCESS_KEY!: string;

	@IsString()
	@IsOptional()
	AWS_ENDPOINT_URL?: string;

	@IsString()
	@IsNotEmpty()
	ADMIN_EMAIL!: string;

	@IsString()
	@IsNotEmpty()
	ADMIN_PASSWORD!: string;

	@IsString()
	@IsNotEmpty()
	JWT_SECRET!: string;

	@IsString()
	@IsNotEmpty()
	BASE_URL!: string;
}
