import { UnauthorizedException } from '@nestjs/common';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';
import { AdminLoginUseCase } from '@/modules/backoffice/application/use-cases/admin-login/admin-login.use-case';
import { AdminEntity } from '@/modules/backoffice/domain/entities/admin.entity';
import { PasswordVo } from '@/modules/backoffice/domain/entities/value-objects/password.vo';
import { IAdminsRepository } from '@/modules/backoffice/domain/repositories/admins.repository';

import { EnvService } from '@/shared/modules/env/env.service';
import { errorMessages } from '@/shared/utils/err-messages';

import { createAdminsRepositoryMock } from '#/data/mocks/repositories/admins.repository';
import { createEnvServiceMock } from '#/data/mocks/services/env-service';
import { createTokenServiceMock } from '#/data/mocks/services/token-service';

describe(AdminLoginUseCase.name, () => {
	let sut: AdminLoginUseCase;
	let adminsRepository: IAdminsRepository;
	let tokenService: ITokenService;
	let envService: EnvService;

	beforeEach(() => {
		adminsRepository = createAdminsRepositoryMock();
		tokenService = createTokenServiceMock();
		envService = createEnvServiceMock();
		sut = new AdminLoginUseCase(adminsRepository, tokenService, envService);
	});

	describe('exec', () => {
		it('should throw UnauthorizedException if admin is not found', async () => {
			vi.spyOn(adminsRepository, 'findByEmail').mockResolvedValueOnce(null);

			await expect(
				sut.exec({
					email: 'nonexistent@example.com',
					password: 'password123',
				}),
			).rejects.toThrow(
				new UnauthorizedException(errorMessages.auth.invalidCredentials),
			);

			expect(adminsRepository.findByEmail).toHaveBeenCalledWith(
				'nonexistent@example.com',
			);
		});

		it('should throw UnauthorizedException if password is invalid', async () => {
			const password = await PasswordVo.create('correctPassword');
			const admin = AdminEntity.createFrom(
				'admin-id-123',
				{
					name: 'Test Admin',
					email: 'admin@example.com',
					password,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);

			vi.spyOn(adminsRepository, 'findByEmail').mockResolvedValueOnce(admin);

			await expect(
				sut.exec({
					email: 'admin@example.com',
					password: 'wrongPassword',
				}),
			).rejects.toThrow(
				new UnauthorizedException(errorMessages.auth.invalidCredentials),
			);

			expect(adminsRepository.findByEmail).toHaveBeenCalledWith(
				'admin@example.com',
			);
		});

		it('should return admin data and token on successful login', async () => {
			const password = await PasswordVo.create('correctPassword');
			const admin = AdminEntity.createFrom(
				'admin-id-123',
				{
					name: 'Test Admin',
					email: 'admin@example.com',
					password,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);

			const mockToken = 'mock-jwt-token-12345';
			const mockJwtSecret = 'test-jwt-secret';

			vi.spyOn(adminsRepository, 'findByEmail').mockResolvedValueOnce(admin);
			vi.spyOn(tokenService, 'sign').mockResolvedValueOnce(mockToken);
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValueOnce(mockJwtSecret);

			const result = await sut.exec({
				email: 'admin@example.com',
				password: 'correctPassword',
			});

			expect(adminsRepository.findByEmail).toHaveBeenCalledWith(
				'admin@example.com',
			);
			expect(envService.getKeyOrThrow).toHaveBeenCalledWith('JWT_SECRET');
			expect(tokenService.sign).toHaveBeenCalledWith(
				{
					email: 'admin@example.com',
					sub: 'admin-id-123',
				},
				3600 * 24,
				mockJwtSecret,
			);

			expect(result).toEqual({
				admin: {
					id: 'admin-id-123',
					name: 'Test Admin',
					email: 'admin@example.com',
				},
				token: mockToken,
			});
		});

		it('should use 24 hour expiration for token', async () => {
			const password = await PasswordVo.create('password');
			const admin = AdminEntity.createFrom(
				'admin-id',
				{
					name: 'Admin',
					email: 'admin@test.com',
					password,
				},
				{
					createdAt: new Date(),
				},
			);

			vi.spyOn(adminsRepository, 'findByEmail').mockResolvedValueOnce(admin);
			vi.spyOn(tokenService, 'sign').mockResolvedValueOnce('token');
			vi.spyOn(envService, 'getKeyOrThrow').mockReturnValueOnce('secret');

			await sut.exec({
				email: 'admin@test.com',
				password: 'password',
			});

			expect(tokenService.sign).toHaveBeenCalledWith(
				expect.any(Object),
				86400, // 3600 * 24 = 86400 seconds (24 hours)
				expect.any(String),
			);
		});
	});
});
