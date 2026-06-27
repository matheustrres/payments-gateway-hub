// path: @/shared/interceptors/admin-audit.interceptor.ts
import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { tap } from 'rxjs/operators';

import {
	ADMIN_AUDIT_METADATA_KEY,
	AdminAuditOptions,
} from '../decorators/admin-audit.decorator';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
	private readonly logger = new Logger(AdminAuditInterceptor.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly dbService: DatabaseService,
	) {}

	intercept(context: ExecutionContext, next: CallHandler) {
		const metadata = this.reflector.get<AdminAuditOptions>(
			ADMIN_AUDIT_METADATA_KEY,
			context.getHandler(),
		);
		if (!metadata) return next.handle();
		const request = context.switchToHttp().getRequest<Request>();
		const ipAddress =
			request.ip ||
			request.headers['x-forwarded-for'] ||
			request.socket.remoteAddress;
		return next.handle().pipe(
			tap(async (responseBody) => {
				const adminId = request.user?.sub || responseBody?.admin?.id || null;
				if (!adminId && metadata.action === 'LOGIN') {
					this.logger.warn(
						'Tentativa de login auditada, mas nenhum ID de admin foi encontrado na resposta.',
					);
					return;
				}
				try {
					const resourceId = this.extractResourceId(
						metadata,
						request,
						responseBody,
						adminId,
					);
					await this.dbService.adminAudit.create({
						data: {
							action: metadata.action,
							resource: metadata.resource,
							resourceId: String(resourceId),
							adminId: String(adminId),
							ipAddress: String(ipAddress),
							newData:
								metadata.action !== 'READ' ? this.sanitize(request.body) : null,
						},
					});
				} catch (error) {
					console.log({ error });
					this.logger.error(
						'Falha ao gravar log de auditoria administrativa',
						error,
					);
				}
			}),
		);
	}

	private extractResourceId(
		metadata: AdminAuditOptions,
		req: any,
		res: any,
		adminId: any,
	): string {
		if (metadata.action === 'LOGIN') return String(adminId);
		if (metadata.resource === 'PROVIDER_CREDENTIAL') {
			return req.params?.projectId || req.params?.id || 'N/A';
		}
		if (metadata.action === 'CREATE') {
			return (
				res?.id || res?.project?.id || res?.transaction?.id || 'NEW_RESOURCE'
			);
		}
		return req.params?.id || 'N/A';
	}

	private sanitize(data: any): any {
		if (!data || typeof data !== 'object') return data;
		const SENSITIVE_FIELDS = [
			'password',
			'apiKey',
			'webhookSecret',
			'testApiKey',
			'liveApiKey',
			'token',
			'secret',
			'access_token',
			'encryptedCredentials',
		];
		if (Array.isArray(data)) {
			return data.map((item) => this.sanitize(item));
		}
		const sanitized = { ...data };
		for (const key in sanitized) {
			if (
				SENSITIVE_FIELDS.some((field) =>
					key.toLowerCase().includes(field.toLowerCase()),
				)
			)
				sanitized[key] = '[REDACTED]';
			else if (typeof sanitized[key] === 'object' && sanitized[key] !== null)
				sanitized[key] = this.sanitize(sanitized[key]);
		}
		return sanitized;
	}
}
