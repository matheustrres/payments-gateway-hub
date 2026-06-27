import { EHttpStatusCode } from '@/core/enums/status-code';

import { SwaggerRoute } from '@/shared/docs/swagger';

export function CreateProcessInboundWebhookSwaggerRoute() {
	return SwaggerRoute({
		operation: 'Process inbound webhook from payment provider',
		responses: [
			{
				status: EHttpStatusCode.OK,
				description:
					'Webhook processado com sucesso. O evento foi registrado e a transação associada foi atualizada conforme necessário.',
			},
			{
				status: EHttpStatusCode.BadRequest,
				description:
					'Requisição inválida. Pode ocorrer quando: provedor não é suportado, payload está malformado ou headers obrigatórios estão ausentes.',
			},
			{
				status: EHttpStatusCode.NotFound,
				description:
					'Transação não encontrada. O externalId presente no webhook não corresponde a nenhuma transação no sistema.',
			},
			{
				status: EHttpStatusCode.InternalServerError,
				description:
					'Erro interno do servidor. Pode ocorrer por falha ao processar o webhook, erro de parsing ou falha ao persistir as atualizações.',
			},
		],
	});
}
