import { GetTransactionAuditSummaryQueryDto } from '../dtos/transaction-audit-summary';

import { EHttpStatusCode } from '@/core/enums/status-code';

import { OPEN_API_JWT_AUTH_NAME, SwaggerRoute } from '@/shared/docs/swagger';

export function CreateGetTransactionAuditSummarySwaggerRoute() {
	return SwaggerRoute({
		operation:
			'Consulta o "Raio-X" detalhado de uma transação. Consolida auditoria inbound (webhook bruto), timeline de estados e logs de entrega outbound.',
		queries: [{ type: GetTransactionAuditSummaryQueryDto }],
		authName: OPEN_API_JWT_AUTH_NAME,
		responses: [
			{
				status: EHttpStatusCode.OK,
				description:
					'Resumo de auditoria retornado com sucesso. Inclui dados sanitizados de headers e aviso de retenção caso os logs antigos tenham sido removidos pelo worker de limpeza.',
			},
			{
				status: EHttpStatusCode.BadRequest,
				description:
					'Requisição inválida. O parâmetro "by" deve ser obrigatoriamente "transactionId" ou "externalId".',
			},
			{
				status: EHttpStatusCode.Unauthorized,
				description:
					'Não autorizado. Token JWT administrativo inválido ou ausente.',
			},
			{
				status: EHttpStatusCode.Forbidden,
				description:
					'Acesso negado. O usuário autenticado não possui privilégios de administrador.',
			},
			{
				status: EHttpStatusCode.NotFound,
				description:
					'Transação não encontrada. Não foi possível localizar um registro com o ID fornecido.',
			},
			{
				status: EHttpStatusCode.InternalServerError,
				description:
					'Erro interno do servidor ao processar a agregação dos logs de diferentes módulos.',
			},
		],
	});
}
