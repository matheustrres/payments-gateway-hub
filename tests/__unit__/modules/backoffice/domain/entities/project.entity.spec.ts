import { EntityCuid } from '@/core/domain/entities/entity-cuid';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';

describe(ProjectEntity.name, () => {
	describe('.createNew', () => {
		it('should throw if webhookUrl does not start with https://', () => {
			const originalEnv = process.env['NODE_ENV'];
			process.env['NODE_ENV'] = 'production'; // Force non-testing environment

			expect(() => {
				ProjectEntity.createNew({
					testApiKeyHash: 'test_hashed_key',
					testApiKeyPrefix: 'sk_test_',
					liveApiKeyHash: 'live_hashed_key',
					liveApiKeyPrefix: 'sk_live_',
					isActive: true,
					name: 'Test Project',
					webhookUrl: 'http://insecure-url.com/webhook',
				});
			}).toThrowError('webhookUrl must start with https://');

			process.env['NODE_ENV'] = originalEnv; // Restore original value
		});

		it('should create a new project entity', () => {
			const project = ProjectEntity.createNew({
				testApiKeyHash: 'test_hashed_key',
				testApiKeyPrefix: 'sk_test_',
				liveApiKeyHash: 'live_hashed_key',
				liveApiKeyPrefix: 'sk_live_',
				isActive: true,
				name: 'Test Project',
				webhookUrl: 'https://example.com/webhook',
			});
			expect(project).toBeInstanceOf(ProjectEntity);
			expect(project.id).toBeInstanceOf(EntityCuid);
		});
	});

	describe('.createFrom', () => {
		it('should create a project entity from existing data', () => {
			const project = ProjectEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				{
					testApiKeyHash: 'test_hashed_key',
					testApiKeyPrefix: 'sk_test_',
					liveApiKeyHash: 'live_hashed_key',
					liveApiKeyPrefix: 'sk_live_',
					isActive: false,
					name: 'Existing Project',
					webhookUrl: 'https://example.com/webhook',
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			expect(project).toBeInstanceOf(ProjectEntity);
			expect(project.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(project.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
			expect(project.updatedAt?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
		});
	});

	describe('.activate', () => {
		it('should return early if already active', () => {
			const project = ProjectEntity.createNew({
				testApiKeyHash: 'test_hashed_key',
				testApiKeyPrefix: 'sk_test_',
				liveApiKeyHash: 'live_hashed_key',
				liveApiKeyPrefix: 'sk_live_',
				isActive: true,
				name: 'Active Project',
				webhookUrl: 'https://example.com/webhook',
			});
			const prevUpdatedAt = project.updatedAt;
			project.activate();
			expect(project.isActive).toBe(true);
			expect(project.updatedAt).toBe(prevUpdatedAt);
		});

		it('should activate an inactive project', () => {
			const project = ProjectEntity.createNew({
				testApiKeyHash: 'test_hashed_key',
				testApiKeyPrefix: 'sk_test_',
				liveApiKeyHash: 'live_hashed_key',
				liveApiKeyPrefix: 'sk_live_',
				isActive: false,
				name: 'Inactive Project',
				webhookUrl: 'https://example.com/webhook',
			});
			expect(project.isActive).toBe(false);
			expect(project.updatedAt).toBeNull();
			project.activate();
			expect(project.isActive).toBe(true);
			expect(project.updatedAt).not.toBeNull();
		});
	});

	describe('.deactivate', () => {
		it('should return early if already inactive', () => {
			const project = ProjectEntity.createNew({
				testApiKeyHash: 'test_hashed_key',
				testApiKeyPrefix: 'sk_test_',
				liveApiKeyHash: 'live_hashed_key',
				liveApiKeyPrefix: 'sk_live_',
				isActive: false,
				name: 'Inactive Project',
				webhookUrl: 'https://example.com/webhook',
			});
			const prevUpdatedAt = project.updatedAt;
			project.deactivate();
			expect(project.isActive).toBe(false);
			expect(project.updatedAt).toBe(prevUpdatedAt);
		});

		it('should deactivate an active project', () => {
			const project = ProjectEntity.createNew({
				testApiKeyHash: 'test_hashed_key',
				testApiKeyPrefix: 'sk_test_',
				liveApiKeyHash: 'live_hashed_key',
				liveApiKeyPrefix: 'sk_live_',
				isActive: true,
				name: 'Active Project',
				webhookUrl: 'https://example.com/webhook',
			});
			expect(project.isActive).toBe(true);
			expect(project.updatedAt).toBeNull();
			project.deactivate();
			expect(project.isActive).toBe(false);
			expect(project.updatedAt).not.toBeNull();
		});
	});
});
