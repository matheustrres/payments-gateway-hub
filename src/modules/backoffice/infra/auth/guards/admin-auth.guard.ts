import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';

import { IS_PUBLIC_KEY } from '@/shared/auth/decorators/public.decorator';
import { EnvService } from '@/shared/modules/env/env.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
	constructor(
		private readonly tokenService: ITokenService,
		private readonly envService: EnvService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		if (!request.url.startsWith('/backoffice')) {
			return true;
		}
		if (this.isPublic(context)) return true;
		const token = this.extractTokenFromHeader(request);
		if (!token) {
			throw new UnauthorizedException('Missing authorization token');
		}
		try {
			const jwtSecret = this.envService.getKeyOrThrow('JWT_SECRET');
			const isValid = this.tokenService.verify(token, jwtSecret);
			if (!isValid) {
				throw new UnauthorizedException('Invalid token');
			}
			const payload = this.tokenService.decode(token);
			request.user = {
				sub: payload.sub,
				email: payload.email,
			};
			return true;
		} catch {
			throw new UnauthorizedException('Invalid or expired token');
		}
	}

	private extractTokenFromHeader(request: Request): string | undefined {
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
