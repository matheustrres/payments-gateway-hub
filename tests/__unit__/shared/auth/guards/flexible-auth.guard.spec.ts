import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';

import { FlexibleAuthGuard } from '@/shared/auth/guards/flexible-auth.guard';
import { EnvService } from '@/shared/modules/env/env.service';

import { createProjectsRepositoryMock } from '#/data/mocks/repositories/projects.repository';
import { createEnvServiceMock } from '#/data/mocks/services/env-service';
import { createTokenServiceMock } from '#/data/mocks/services/token-service';

describe(FlexibleAuthGuard.name, () => {
	let guard: FlexibleAuthGuard;
	let tokenService: ITokenService;
	let envService: EnvService;
	let projectsRepository: IProjectsRepository;
	let reflector: Reflector;

	beforeEach(() => {
		tokenService = createTokenServiceMock();
		envService = createEnvServiceMock();
		projectsRepository = createProjectsRepositoryMock();
		reflector = new Reflector();
		guard = new FlexibleAuthGuard(
			tokenService,
			envService,
			projectsRepository,
			reflector,
		);
	});

	const createMockContext = (
		bearerToken?: string,
		apiKey?: string,
	): ExecutionContext => {
		const headers: any = {};
		if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
		if (apiKey) headers['x-api-key'] = apiKey;
		const mockRequest = {
			headers,
			user: undefined,
			project: undefined,
			authType: undefined,
		};
		return {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		} as unknown as ExecutionContext;
	};

	it('should accept valid JWT Bearer token', async () => {
		const context = createMockContext('valid-jwt-token');
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
		vi.spyOn(tokenService, 'verify').mockReturnValue(true);
		vi.spyOn(tokenService, 'decode').mockReturnValue({
			sub: 'admin-123',
			email: 'admin@test.com',
		});
		const result = await guard.canActivate(context);
		expect(result).toBe(true);
		const request = context.switchToHttp().getRequest();
		expect(request.user).toEqual({ sub: 'admin-123', email: 'admin@test.com' });
		expect(request.authType).toBe('admin');
	});

	it('should accept valid API Key when JWT not present', async () => {
		const context = createMockContext(undefined, 'sk_test_validkey123');
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		const mockProject = {
			id: { toString: () => 'project-123' },
			name: 'Test Project',
			isActive: true,
		};
		vi.spyOn(projectsRepository, 'findByApiKeyHash').mockResolvedValue(
			mockProject as any,
		);
		const result = await guard.canActivate(context);
		expect(result).toBe(true);
		const request = context.switchToHttp().getRequest();
		expect(request.project).toEqual({
			id: 'project-123',
			name: 'Test Project',
			isProduction: false,
		});
		expect(request.authType).toBe('project');
	});

	it('should prioritize JWT over API Key when both present', async () => {
		const context = createMockContext('valid-jwt', 'sk_test_validkey');
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
		vi.spyOn(tokenService, 'verify').mockReturnValue(true);
		vi.spyOn(tokenService, 'decode').mockReturnValue({
			sub: 'admin-123',
			email: 'admin@test.com',
		});
		const result = await guard.canActivate(context);
		expect(result).toBe(true);
		const request = context.switchToHttp().getRequest();
		expect(request.authType).toBe('admin');
		expect(projectsRepository.findByApiKeyHash).not.toHaveBeenCalled();
	});

	it('should throw UnauthorizedException when both auth methods missing', async () => {
		const context = createMockContext();
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		await expect(guard.canActivate(context)).rejects.toThrow(
			new UnauthorizedException('Missing or invalid authentication'),
		);
	});

	it('should throw UnauthorizedException when JWT invalid and no API Key', async () => {
		const context = createMockContext('invalid-jwt');
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		vi.spyOn(envService, 'getKeyOrThrow').mockReturnValue('jwt-secret');
		vi.spyOn(tokenService, 'verify').mockReturnValue(false);
		await expect(guard.canActivate(context)).rejects.toThrow(
			new UnauthorizedException('Missing or invalid authentication'),
		);
	});

	it('should return true for public routes', async () => {
		const context = createMockContext();
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
		const result = await guard.canActivate(context);
		expect(result).toBe(true);
	});

	it('should throw when API Key project is inactive', async () => {
		const context = createMockContext(undefined, 'sk_test_validkey123');
		vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
		const mockProject = {
			id: { toString: () => 'project-123' },
			name: 'Test Project',
			isActive: false,
		};
		vi.spyOn(projectsRepository, 'findByApiKeyHash').mockResolvedValue(
			mockProject as any,
		);
		await expect(guard.canActivate(context)).rejects.toThrow(
			new UnauthorizedException('Missing or invalid authentication'),
		);
	});
});
