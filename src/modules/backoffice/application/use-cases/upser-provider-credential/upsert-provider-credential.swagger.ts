import { UpsertProviderCredentialBodyDto } from '../dtos/upsert-provider-credential.dto';

import { EHttpStatusCode } from '@/core/enums/status-code';

import { OPEN_API_JWT_AUTH_NAME, SwaggerRoute } from '@/shared/docs/swagger';

export function CreateUpsertProviderCredentialSwaggerRoute() {
	return SwaggerRoute({
		operation:
			'Cria ou atualiza as credenciais de um provedor de pagamento para um projeto específico.',
		body: UpsertProviderCredentialBodyDto,
		authName: OPEN_API_JWT_AUTH_NAME,
		responses: [
			{
				status: EHttpStatusCode.NoContent,
				description:
					'Credenciais do provedor criadas ou atualizadas com sucesso. A operação é idempotente: se as credenciais já existirem para o provedor e ambiente (produção/sandbox), elas serão atualizadas.',
			},
			{
				status: EHttpStatusCode.BadRequest,
				description:
					'Requisição inválida. Pode ocorrer quando: credenciais vazias ou nulas, provedor inválido, prioridade inválida, ou formato de credenciais incorreto.',
			},
			{
				status: EHttpStatusCode.Unauthorized,
				description: 'Não autorizado. Token JWT inválido ou ausente.',
			},
			{
				status: EHttpStatusCode.NotFound,
				description:
					'Projeto não encontrado. O projectId fornecido não existe no sistema.',
			},
			{
				status: EHttpStatusCode.InternalServerError,
				description:
					'Erro interno do servidor. Pode ocorrer por falha ao criptografar credenciais, erro ao salvar no banco de dados, ou outras falhas inesperadas.',
			},
		],
	});
}
