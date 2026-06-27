import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
	Validate,
} from 'class-validator';

import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';

import { AtLeastOnePropertyValidator } from '@/shared/validators/at-least-one-property.validator';

export class FindChargesQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Idempotency key of the charge' })
	idempotencyKey?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Project ID to filter charges' })
	projectId?: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Type(() => Number)
	@ApiPropertyOptional({ default: 1, minimum: 1 })
	page?: number = 1;

	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	limit?: number = 20;

	@Validate(AtLeastOnePropertyValidator, ['idempotencyKey', 'projectId'], {
		message: 'At least one of idempotencyKey or projectId must be provided',
	})
	validateAtLeastOne() {
		return true;
	}
}

export type FindChargesUseCaseInput = {
	idempotencyKey?: string;
	projectId?: string;
	page: number;
	limit: number;
	authType: 'admin' | 'project';
	authenticatedProjectId?: string;
};

export class FindChargesUseCaseOutput {
	@ApiProperty({ type: [TransactionEntity] })
	charges!: TransactionEntity[];

	@ApiProperty({ description: 'Total number of charges matching criteria' })
	total!: number;

	@ApiProperty({ description: 'Current page number' })
	page!: number;

	@ApiProperty({ description: 'Number of items per page' })
	limit!: number;

	@ApiProperty({ description: 'Whether there are more pages available' })
	hasMore!: boolean;
}
