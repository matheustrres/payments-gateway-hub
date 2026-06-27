import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsString,
	IsNotEmpty,
	IsPhoneNumber,
	IsEmail,
	IsOptional,
	ValidateNested,
	IsNumberString,
	Length,
} from 'class-validator';

import { EPaymentMethod, ECurrency } from '@/core/enums/payment';

export class CustomerDetailsDto {
	@ApiProperty({
		type: 'string',
		required: true,
		description: 'Nome completo do cliente',
		example: 'João da Silva',
	})
	@IsString()
	@IsNotEmpty()
	name!: string;

	@ApiProperty({
		type: 'string',
		required: true,
		description: 'Número de telefone celular do cliente',
		example: '+5511999999999',
	})
	@IsString()
	@IsPhoneNumber('BR')
	@IsNotEmpty()
	cellphone!: string;

	@ApiProperty({
		type: 'string',
		required: true,
		description: 'Endereço de e-mail do cliente',
		example: 'joao.silva@example.com',
	})
	@IsString()
	@IsEmail()
	@IsNotEmpty()
	email!: string;

	@ApiProperty({
		type: 'string',
		required: true,
		description: 'CPF ou CNPJ do cliente',
		example: '12345678901',
	})
	@IsString()
	@IsNotEmpty()
	taxId!: string;

	@ApiProperty({
		type: 'string',
		required: false,
		description: 'CEP do cliente (Necessário para Cartão de Crédito)',
		example: '01001000',
	})
	@IsString()
	@IsOptional()
	postalCode?: string;

	@ApiProperty({
		type: 'string',
		required: false,
		description: 'Número do endereço (Necessário para Cartão de Crédito)',
		example: '123',
	})
	@IsString()
	@IsOptional()
	addressNumber?: string;
}

export class CreditCardDto {
	@ApiProperty({
		description: 'Nome impresso no cartão',
		example: 'JOAO DA SILVA',
	})
	@IsString()
	@IsNotEmpty()
	holderName!: string;

	@ApiProperty({ description: 'Número do cartão', example: '4111111111111111' })
	@IsString()
	@IsNumberString()
	@Length(13, 19)
	number!: string;

	@ApiProperty({ description: 'Mês de expiração (MM)', example: '12' })
	@IsString()
	@Length(2, 2)
	expiryMonth!: string;

	@ApiProperty({ description: 'Ano de expiração (YYYY)', example: '2030' })
	@IsString()
	@Length(4, 4)
	expiryYear!: string;

	@ApiProperty({ description: 'Código de segurança (CVV)', example: '123' })
	@IsString()
	@Length(3, 4)
	cvv!: string;
}

export class PixDetailsBodyDto {
	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	productName!: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	returnUrl!: string;

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	completionUrl!: string;

	@ApiProperty({ type: CustomerDetailsDto, required: false })
	@ValidateNested()
	@Type(() => CustomerDetailsDto)
	@IsOptional()
	customer?: CustomerDetailsDto;
}

// --- TYPES DE GATEWAY (Adapter Input) ---

type PaymentGatewayInput = {
	apiKey: string;
	isSandbox: boolean;
	amountInCents: number;
	currency: ECurrency;
	idempotencyKey: string;
	customer: CustomerDetailsDto;
	metadata?: Record<string, unknown>;
};

export type PixPaymentGatewayInput = PaymentGatewayInput & {
	paymentMethod: EPaymentMethod.Pix;
	productName: string;
	returnUrl: string;
	completionUrl: string;
	externalId?: string;
};

export type BoletoPaymentGatewayInput = PaymentGatewayInput & {
	paymentMethod: EPaymentMethod.Boleto;
	dueDate?: string; // Data de vencimento YYYY-MM-DD
	description?: string;
};

export type CreditCardPaymentGatewayInput = PaymentGatewayInput & {
	paymentMethod: EPaymentMethod.Card;
	card: CreditCardDto;
	description?: string;
	dueDate?: string;
};

export type PaymentInput =
	| PixPaymentGatewayInput
	| BoletoPaymentGatewayInput
	| CreditCardPaymentGatewayInput;
