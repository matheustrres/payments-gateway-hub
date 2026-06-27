import { EntityCuid } from '@/core/domain/entities/entity-cuid';

import { AdminEntity } from '@/modules/backoffice/domain/entities/admin.entity';
import { PasswordVo } from '@/modules/backoffice/domain/entities/value-objects/password.vo';

describe(AdminEntity.name, () => {
	describe('.createNew', () => {
		it('should create a new admin entity', async () => {
			const password = await PasswordVo.create('password123');
			const admin = AdminEntity.createNew({
				name: 'Test Admin',
				email: 'test@example.com',
				password,
			});

			expect(admin).toBeInstanceOf(AdminEntity);
			expect(admin.id).toBeInstanceOf(EntityCuid);
			expect(admin.name).toBe('Test Admin');
			expect(admin.email).toBe('test@example.com');
			expect(admin.password).toBeInstanceOf(PasswordVo);
		});
	});

	describe('.createFrom', () => {
		it('should create an admin entity from existing data', () => {
			const password = PasswordVo.create('hashedPassword', true);
			const admin = AdminEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				{
					name: 'Existing Admin',
					email: 'existing@example.com',
					password,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);

			expect(admin).toBeInstanceOf(AdminEntity);
			expect(admin.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(admin.name).toBe('Existing Admin');
			expect(admin.email).toBe('existing@example.com');
			expect(admin.password).toBeInstanceOf(PasswordVo);
			expect(admin.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});
	});

	describe('getters', () => {
		it('should return correct property values', async () => {
			const password = await PasswordVo.create('password123');
			const admin = AdminEntity.createNew({
				name: 'John Doe',
				email: 'john@example.com',
				password,
			});

			expect(admin.name).toBe('John Doe');
			expect(admin.email).toBe('john@example.com');
			expect(admin.password).toBe(password);
		});
	});

	describe('password comparison', () => {
		it('should compare passwords correctly', async () => {
			const password = await PasswordVo.create('mySecretPassword');
			const admin = AdminEntity.createNew({
				name: 'Test Admin',
				email: 'test@example.com',
				password,
			});

			const isValid = await admin.password.compare('mySecretPassword');
			expect(isValid).toBe(true);

			const isInvalid = await admin.password.compare('wrongPassword');
			expect(isInvalid).toBe(false);
		});
	});
});
