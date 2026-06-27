import { BadRequestException } from '@nestjs/common';
import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsString,
	ValidateNested,
	IsOptional,
	IsDateString,
} from 'class-validator';

import {
	PixDetailsBodyDto,
	CustomerDetailsDto,
	CreditCardDto,
} from './payment-input.dto'; // Assumindo que estão exportados daqui

import { ECurrency, EPaymentMethod } from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

export type PixChargeDetails = {
	productName: string;
	returnUrl: string;
	completionUrl: string;
	customer?: {
		name: string;
		email: string;
		cellphone: string;
		taxId: string;
	};
};

export type BoletoChargeDetails = {
	customer: CustomerDetailsDto; // Obrigatório para Asaas
	dueDate?: string;
	description?: string;
};

export type CreditCardChargeDetails = {
	customer: CustomerDetailsDto; // Obrigatório para Asaas
	card: CreditCardDto;
	description?: string;
};

export type ChargeDetails =
	| PixChargeDetails
	| BoletoChargeDetails
	| CreditCardChargeDetails;

export type CreateChargeUseCaseInput = {
	projectId: string;
	amountInCents: number;
	currency: ECurrency;
	idempotencyKey: string;
	paymentMethod: EPaymentMethod;
	details: ChargeDetails;
	isProduction?: boolean;
};

export type CreateChargeUseCaseOutput = {
	transaction: {
		id: string;
		idempotencyKey: string;
		externalId: string;
		externalStatus: string;
		amount: {
			value: number;
			currency: string;
			formatted: string;
		};
		currency: string;
		paymentMethod: string;
		provider: string;
		status: string;
		customerEmail: string;
		customerTaxId: string;
		paymentData: PaymentMetadata;
	};
};
// --- DTOs para o Body da Requisição ---

export class BoletoDetailsBodyDto {
	@ApiProperty({ type: CustomerDetailsDto, required: true })
	@ValidateNested()
	@Type(() => CustomerDetailsDto)
	@IsNotEmpty()
	customer!: CustomerDetailsDto;

	@ApiProperty({ required: false, example: '2024-12-31' })
	@IsDateString()
	@IsOptional()
	dueDate?: string;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	description?: string;
}

export class CreditCardDetailsBodyDto {
	@ApiProperty({ type: CustomerDetailsDto, required: true })
	@ValidateNested()
	@Type(() => CustomerDetailsDto)
	@IsNotEmpty()
	customer!: CustomerDetailsDto;

	@ApiProperty({ type: CreditCardDto, required: true })
	@ValidateNested()
	@Type(() => CreditCardDto)
	@IsNotEmpty()
	card!: CreditCardDto;

	@ApiProperty({ required: false })
	@IsString()
	@IsOptional()
	description?: string;
}

export class CreateChargeBodyDto {
	@ApiProperty({ type: 'number', required: true, example: 1000 })
	@IsNumber()
	@IsNotEmpty()
	amountInCents!: number;

	@ApiProperty({ enum: ECurrency, required: true, example: ECurrency.BRL })
	@IsEnum(ECurrency)
	@IsNotEmpty()
	currency!: ECurrency;

	@ApiProperty({ type: 'string', required: true })
	@IsString()
	@IsNotEmpty()
	idempotencyKey!: string;

	@ApiProperty({
		enum: EPaymentMethod,
		required: true,
		example: EPaymentMethod.Pix,
	})
	@IsEnum(EPaymentMethod)
	@IsNotEmpty()
	paymentMethod!: EPaymentMethod;

	@ApiProperty({
		description: 'Detalhes específicos do método de pagamento',
		oneOf: [
			{ $ref: getSchemaPath(PixDetailsBodyDto) },
			{ $ref: getSchemaPath(BoletoDetailsBodyDto) },
			{ $ref: getSchemaPath(CreditCardDetailsBodyDto) },
		],
	})
	@IsObject()
	@ValidateNested()
	@Type((opts) => {
		// Discriminator manual para validação correta
		switch (opts?.object['paymentMethod']) {
			case EPaymentMethod.Pix:
				return PixDetailsBodyDto;
			case EPaymentMethod.Boleto:
				return BoletoDetailsBodyDto;
			case EPaymentMethod.Card:
				return CreditCardDetailsBodyDto;
			default:
				throw new BadRequestException(
					'Método de pagamento inválido. As opções são: PIX, CARD e BOLETO',
				);
		}
	})
	details!: PixDetailsBodyDto | BoletoDetailsBodyDto | CreditCardDetailsBodyDto;

	@ApiProperty({ type: 'boolean', required: false })
	@IsBoolean()
	@IsOptional()
	isProduction?: boolean;
}
