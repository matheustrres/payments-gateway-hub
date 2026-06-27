import { ApiProperty } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNotEmptyObject,
	IsObject,
	IsOptional,
} from 'class-validator';

import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';

export type UpsertProviderCredentialsUseCaseInput = {
	projectId: string;
	provider: EPaymentProvider;
	credentials: Record<string, unknown>;
	priority: EPriority;
	isProduction?: boolean;
};

export type UpsertProviderCredentialsUseCaseOutput = void;

export class UpsertProviderCredentialBodyDto {
	@ApiProperty({
		enum: EPaymentProvider,
		required: true,
	})
	@IsEnum(EPaymentProvider)
	@IsNotEmpty()
	provider!: EPaymentProvider;

	@ApiProperty({
		type: 'object',
		additionalProperties: {
			type: 'string',
		},
		description: 'As credenciais do provedor de pagamento',
		example: {
			apiKey: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
			webhookSecret: 'whsec_xxx',
		},
	})
	@IsObject()
	@IsNotEmptyObject()
	credentials!: Record<string, unknown>;

	@ApiProperty({
		enum: EPriority,
		required: true,
	})
	@IsEnum(EPriority)
	@IsNotEmpty()
	priority!: EPriority;

	@ApiProperty({
		type: 'boolean',
		required: false,
		default: false,
	})
	@IsBoolean()
	@IsOptional()
	isProduction?: boolean;
}
