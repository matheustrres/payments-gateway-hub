import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ApiKeyHelper } from '@/core/domain/helpers/api-key.helper';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { ApiKeyGenService } from '@/modules/backoffice/domain/services/api-key-gen.service';

import { IS_PUBLIC_KEY } from '@/shared/auth/decorators/public.decorator';
import { extractApiKeyFromHeaders } from '@/shared/auth/extract-api-key-from-headers';
import { EnvService } from '@/shared/modules/env/env.service';

@Injectable()
export class FlexibleAuthGuard implements CanActivate {
	constructor(
		private readonly tokenService: ITokenService,
		private readonly envService: EnvService,
		private readonly projectsRepository: IProjectsRepository,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		if (this.isPublic(context)) return true;
		const jwtResult = await this.tryJwtAuth(request);
		if (jwtResult) {
			return true;
		}
		// Fallback API Key
		const apiKeyResult = await this.tryApiKeyAuth(request);
		if (apiKeyResult) {
			return true;
		}
		throw new UnauthorizedException('Missing or invalid authentication');
	}

	private async tryJwtAuth(request: Request): Promise<boolean> {
		const token = this.extractBearerToken(request);
		if (!token) {
			return false;
		}
		try {
			const jwtSecret = this.envService.getKeyOrThrow('JWT_SECRET');
			const isValid = this.tokenService.verify(token, jwtSecret);
			if (!isValid) {
				return false;
			}
			const payload = this.tokenService.decode(token);
			request.user = {
				sub: payload.sub,
				email: payload.email,
			};
			request.authType = 'admin';
			return true;
		} catch {
			return false;
		}
	}

	private async tryApiKeyAuth(request: Request): Promise<boolean> {
		const apiKey = extractApiKeyFromHeaders(request.headers);
		if (!apiKey) {
			return false;
		}
		const apiKeyHash = ApiKeyGenService.createHash(apiKey);
		const project = await this.projectsRepository.findByApiKeyHash(apiKeyHash);
		if (!project || !project.isActive) {
			return false;
		}

		const isProduction = ApiKeyHelper.isProduction(apiKey);
		request.project = {
			id: project.id.toString(),
			name: project.name,
			isProduction,
		};
		request.authType = 'project';
		return true;
	}

	private extractBearerToken(request: Request): string | undefined {
		const [type, token] = request.headers.authorization?.split(' ') ?? [];
		return type === 'Bearer' ? token : undefined;
	}

	private isPublic(context: ExecutionContext): boolean {
		return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
	}
}
