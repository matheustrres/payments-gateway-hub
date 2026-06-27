import { GetAdminAuditLogsQueryDto } from '../dtos/admin-audit-logs.dto';

import { EHttpStatusCode } from '@/core/enums/status-code';

import { OPEN_API_JWT_AUTH_NAME, SwaggerRoute } from '@/shared/docs/swagger';

export function CreateGetAdminAuditLogsSwaggerRoute() {
	return SwaggerRoute({
		operation:
			'Lista os logs de auditoria de ações administrativas. Permite filtrar por administrador, recurso e ID do recurso.',
		queries: [{ type: GetAdminAuditLogsQueryDto }],
		authName: OPEN_API_JWT_AUTH_NAME,
		responses: [
			{
				status: EHttpStatusCode.OK,
				description:
					'Lista de logs de auditoria retornada com sucesso. Retorna dados paginados com informações do administrador que realizou cada ação.',
			},
			{
				status: EHttpStatusCode.BadRequest,
				description:
					'Requisição inválida. Parâmetros de paginação ou filtros com formato incorreto.',
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
				status: EHttpStatusCode.InternalServerError,
				description: 'Erro interno do servidor ao buscar os logs de auditoria.',
			},
		],
	});
}
