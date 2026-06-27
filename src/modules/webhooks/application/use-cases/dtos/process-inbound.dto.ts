import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

import { EPaymentProvider } from '@/core/enums/payment';

import { IsCuid } from '@/shared/lib/pipes/cuid.pipe';

export type ProcessInboundWebhookUseCaseInput = {
	eventId?: string;
	projectId: string;
	provider: EPaymentProvider;
	payload: any;
	headers: any;
};
export type ProcessInboundWebhookUseCaseOutput = void;

export class ProcessInboundWebhookBodyDto {
	@ApiProperty({
		type: String,
		required: false,
		description: 'O ID do evento de webhook já registrado (se aplicável)',
		example: 'wh_evt_1234567890',
	})
	@IsCuid()
	@IsOptional()
	eventId?: string;

	@ApiProperty({
		enum: EPaymentProvider,
		example: EPaymentProvider.AbacatePay,
		required: true,
		description: 'O provedor que originou o webhook',
	})
	@IsEnum(EPaymentProvider)
	@IsNotEmpty()
	provider!: EPaymentProvider;

	@ApiProperty({
		description: 'O corpo completo (JSON) recebido do provedor de pagamento',
		type: 'object',
		additionalProperties: true,
		example: { event: 'billing.paid', data: { id: 'pay_123', status: 'paid' } },
	})
	@IsObject()
	@IsNotEmpty()
	payload!: Record<string, unknown>;

	@ApiProperty({
		description:
			'Os cabeçalhos da requisição (essenciais para validação de assinatura)',
		type: 'object',
		additionalProperties: true,
		example: { 'abacate-signature': 'sha256=...' },
	})
	@IsObject()
	@IsNotEmpty()
	headers!: Record<string, any>;
}
