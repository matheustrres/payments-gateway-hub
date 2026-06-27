import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';
import { AdminAuthGuard } from '@/modules/backoffice/infra/auth/guards/admin-auth.guard';

import { IS_PUBLIC_KEY } from '@/shared/auth/decorators/public.decorator';
import { EnvService } from '@/shared/modules/env/env.service';

import { createEnvServiceMock } from '#/data/mocks/services/env-service';
import { createTokenServiceMock } from '#/data/mocks/services/token-service';

describe(AdminAuthGuard.name, () => {
	let guard: AdminAuthGuard;
	let tokenService: ITokenService;
	let envService: EnvService;
	let reflector: Reflector;

	beforeEach(() => {
		tokenService = createTokenServiceMock();
		envService = createEnvServiceMock();
		reflector = new Reflector();
		guard = new AdminAuthGuard(tokenService, envService, reflector);
	});

	const createMockExecutionContext = (
		authHeader?: string,
		url: string = '/backoffice/test',
	): ExecutionContext => {
		const mockRequest = {
			url,
			headers: {
				authorization: authHeader,
			},
			user: undefined,
		};
		return {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		} as unknown as ExecutionContext;
	};

	describe('canActivate', () => {
		it('should return true for non-backoffice routes', async () => {
			const context = createMockExecutionContext(undefined, '/api/charges');
			const result = await guard.canActivate(context);
			expect(result).toBe(true);
		});

		it('should return true for public routes', async () => {
			const context = createMockExecutionContext();
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
			const result = await guard.canActivate(context);
			expect(result).toBe(true);
			expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
				{},
				{},
			]);
		});

		it('should throw UnauthorizedException if authorization header is missing', async () => {
			const context = createMockExecutionContext();
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException('Missing authorization token'),
			);
		});

		it('should throw UnauthorizedException if token type is not Bearer', async () => {
			const context = createMockExecutionContext('Basic invalid-token');
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException('Missing authorization token'),
			);
		});

		it('should throw UnauthorizedException if token is invalid', async () => {
			const context = createMockExecutionContext('Bearer invalid-token');
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
			vi.spyOn(tokenService, 'verify').mockReturnValue(false);
			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException('Invalid or expired token'),
			);
			expect(tokenService.verify).toHaveBeenCalledWith(
				'invalid-token',
				'jwt-secret',
			);
		});

		it('should throw UnauthorizedException if token verification throws error', async () => {
			const context = createMockExecutionContext('Bearer expired-token');
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
			vi.spyOn(tokenService, 'verify').mockImplementation(() => {
				throw new Error('Token expired');
			});
			await expect(guard.canActivate(context)).rejects.toThrow(
				new UnauthorizedException('Invalid or expired token'),
			);
		});

		it('should return true and set user in request for valid token', async () => {
			const context = createMockExecutionContext('Bearer valid-token');
			const mockPayload = {
				sub: 'admin-id-123',
				email: 'admin@example.com',
			};
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
			vi.spyOn(tokenService, 'verify').mockReturnValue(true);
			vi.spyOn(tokenService, 'decode').mockReturnValue(mockPayload);
			const result = await guard.canActivate(context);
			expect(result).toBe(true);
			expect(tokenService.verify).toHaveBeenCalledWith(
				'valid-token',
				'jwt-secret',
			);
			expect(tokenService.decode).toHaveBeenCalledWith('valid-token');
			const request = context.switchToHttp().getRequest();
			expect(request.user).toEqual({
				sub: 'admin-id-123',
				email: 'admin@example.com',
			});
		});

		it('should extract JWT_SECRET from environment', async () => {
			const context = createMockExecutionContext('Bearer valid-token');
			const mockSecret = 'my-super-secret-key';
			vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue(mockSecret);
			vi.spyOn(tokenService, 'verify').mockReturnValue(true);
			vi.spyOn(tokenService, 'decode').mockReturnValue({
				sub: 'admin-id',
				email: 'admin@test.com',
			});
			await guard.canActivate(context);
			expect(envService.getKeyOrThrow).toHaveBeenCalledWith('JWT_SECRET');
			expect(tokenService.verify).toHaveBeenCalledWith(
				'valid-token',
				mockSecret,
			);
		});
	});
});
