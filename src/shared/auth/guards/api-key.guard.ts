import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { extractApiKeyFromHeaders } from '../extract-api-key-from-headers';

import { ApiKeyHelper } from '@/core/domain/helpers/api-key.helper';

import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { ApiKeyGenService } from '@/modules/backoffice/domain/services/api-key-gen.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
	constructor(
		private readonly projectsRepository: IProjectsRepository,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		if (request.url.startsWith('/backoffice')) {
			return true;
		}
		if (this.isPublic(context)) {
			return true;
		}
		const apiKey = extractApiKeyFromHeaders(request.headers);
		if (!apiKey) {
			throw new UnauthorizedException('Missing API key header (x-api-key)');
		}
		const apiKeyHash = ApiKeyGenService.createHash(apiKey);
		const project = await this.projectsRepository.findByApiKeyHash(apiKeyHash);
		if (!project) {
			throw new UnauthorizedException('Invalid or inactive API key');
		}
		if (!project.isActive) {
			throw new UnauthorizedException('Project is inactive');
		}
		const isProduction = ApiKeyHelper.isProduction(apiKey);
		request.project = {
			id: project.id.toString(),
			name: project.name,
			isProduction,
		};
		return true;
	}

	private isPublic(context: ExecutionContext): boolean {
		return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
	}
}
