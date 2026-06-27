import { EHttpStatusCode } from '@/core/enums/status-code';

import { CreateChargeBodyDto } from '@/modules/payments/application/dtos/create-charge.dto';

import { OPEN_API_AUTH_NAME, SwaggerRoute } from '@/shared/docs/swagger';

export function CreateCreateChargeSwaggerRoute() {
	return SwaggerRoute({
		operation: 'Create a new charge',
		body: CreateChargeBodyDto,
		authName: OPEN_API_AUTH_NAME,
		responses: [
			{
				status: EHttpStatusCode.Created,
				description:
					'Cobrança criada com sucesso. Retorna os detalhes da transação incluindo informações de pagamento (QR Code para Pix, etc).',
				schema: {
					type: 'object',
					properties: {
						transaction: {
							type: 'object',
							properties: {
								id: {
									type: 'string',
									example: 'clxyz1234567890abcdefg',
									description: 'ID único da transação',
								},
								idempotencyKey: {
									type: 'string',
									example: 'unique-key-123',
									description: 'Chave de idempotência fornecida na requisição',
								},
								externalId: {
									type: 'string',
									example: 'ext_abc123',
									description: 'ID da transação no gateway de pagamento',
								},
								externalStatus: {
									type: 'string',
									example: 'PENDING',
									description: 'Status da transação no gateway externo',
								},
								amount: {
									type: 'object',
									properties: {
										value: {
											type: 'number',
											example: 10000,
											description: 'Valor em centavos',
										},
										currency: {
											type: 'string',
											example: 'BRL',
											description: 'Código da moeda',
										},
										formatted: {
											type: 'string',
											example: 'R$ 100,00',
											description: 'Valor formatado',
										},
									},
								},
								amountInCents: {
									type: 'number',
									example: 100,
									description: 'Valor em reais (centavos convertidos)',
								},
								currency: {
									type: 'string',
									example: 'BRL',
									description: 'Moeda da transação',
								},
								paymentMethod: {
									type: 'string',
									example: 'PIX',
									description: 'Método de pagamento',
								},
								provider: {
									type: 'string',
									example: 'AbacatePay',
									description: 'Provedor de pagamento utilizado',
								},
								status: {
									type: 'string',
									example: 'PENDING',
									description: 'Status interno da transação',
								},
								customerEmail: {
									type: 'string',
									example: 'customer@example.com',
									description: 'Email do cliente',
								},
								customerTaxId: {
									type: 'string',
									example: '12345678901',
									description: 'CPF/CNPJ do cliente',
								},
								paymentData: {
									type: 'object',
									description: 'Dados específicos do método de pagamento',
									example: {
										qrCode: 'base64_encoded_qr_code',
										pixKey: 'chave-pix-exemplo',
									},
								},
								createdAt: {
									type: 'string',
									format: 'date-time',
									example: '2024-01-01T12:00:00.000Z',
									description: 'Data de criação da transação',
								},
								updatedAt: {
									type: 'string',
									format: 'date-time',
									example: '2024-01-01T12:00:00.000Z',
									description: 'Data da última atualização',
									nullable: true,
								},
							},
						},
					},
				},
			},
			{
				status: EHttpStatusCode.BadRequest,
				description:
					'Requisição inválida. Pode ocorrer quando: método de pagamento não suportado, dados obrigatórios ausentes ou formato inválido.',
			},
			{
				status: EHttpStatusCode.NotFound,
				description:
					'Projeto não encontrado. O projectId fornecido não existe no sistema.',
			},
			{
				status: EHttpStatusCode.InternalServerError,
				description:
					'Erro interno do servidor. Pode ocorrer por falha ao criar a transação ou erro de comunicação com o gateway de pagamento.',
			},
		],
	});
}
