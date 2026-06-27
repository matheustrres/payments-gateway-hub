import { describe, expect, it } from 'vitest';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';

import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

describe(ProviderCredentialEntity.name, () => {
	const defaultProps = {
		projectId: EntityCuid.create(),
		provider: EPaymentProvider.Asaas,
		encryptedCredentials: 'iv123:encrypted456:tag789' as const,
		priority: EPriority.Medium,
		isProduction: false,
	};

	describe('.createNew', () => {
		it('should create a new provider credential entity', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential).toBeInstanceOf(ProviderCredentialEntity);
			expect(credential.id).toBeInstanceOf(EntityCuid);
			expect(credential.projectId).toBe(defaultProps.projectId);
			expect(credential.provider).toBe(defaultProps.provider);
			expect(credential.encryptedCredentials).toBe(
				defaultProps.encryptedCredentials,
			);
			expect(credential.priority).toBe(defaultProps.priority);
			expect(credential.isProduction).toBe(false);
		});

		it('should default isProduction to false if not provided', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential.isProduction).toBe(false);
		});

		it('should create production credential when isProduction is true', () => {
			const credential = ProviderCredentialEntity.createNew({
				...defaultProps,
				isProduction: true,
			});
			expect(credential.isProduction).toBe(true);
		});

		it('should create credential with different providers', () => {
			const providers = [EPaymentProvider.Asaas, EPaymentProvider.AbacatePay];
			providers.forEach((provider) => {
				const credential = ProviderCredentialEntity.createNew({
					...defaultProps,
					provider,
				});
				expect(credential.provider).toBe(provider);
			});
		});

		it('should create credential with different priorities', () => {
			const priorities = [EPriority.High, EPriority.Medium, EPriority.Low];
			priorities.forEach((priority) => {
				const credential = ProviderCredentialEntity.createNew({
					...defaultProps,
					priority,
				});
				expect(credential.priority).toBe(priority);
			});
		});
	});

	describe('.createFrom', () => {
		it('should create a provider credential entity from existing data', () => {
			const id = 'cl9v1x5f20000qzrmn5g6z5v3';
			const credential = ProviderCredentialEntity.createFrom(
				id,
				{
					...defaultProps,
					isProduction: true,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			expect(credential).toBeInstanceOf(ProviderCredentialEntity);
			expect(credential.id.toString()).toBe(id);
			expect(credential.projectId).toBe(defaultProps.projectId);
			expect(credential.provider).toBe(defaultProps.provider);
			expect(credential.encryptedCredentials).toBe(
				defaultProps.encryptedCredentials,
			);
			expect(credential.priority).toBe(defaultProps.priority);
			expect(credential.isProduction).toBe(true);
			expect(credential.createdAt.toISOString()).toBe(
				'2024-01-01T00:00:00.000Z',
			);
			expect(credential.updatedAt?.toISOString()).toBe(
				'2024-02-01T00:00:00.000Z',
			);
		});

		it('should create credential without metadata', () => {
			const id = 'cl9v1x5f20000qzrmn5g6z5v3';
			const credential = ProviderCredentialEntity.createFrom(id, {
				...defaultProps,
				isProduction: false,
			});
			expect(credential).toBeInstanceOf(ProviderCredentialEntity);
			expect(credential.id.toString()).toBe(id);
			expect(credential.updatedAt).toBeNull();
		});
	});

	describe('.setCredentials', () => {
		it('should update credentials and return true when credentials change', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			const newCredentials = 'new-iv:new-encrypted:new-tag' as const;
			expect(credential.updatedAt).toBeNull();
			const result = credential.setCredentials(newCredentials);
			expect(result).toBe(true);
			expect(credential.encryptedCredentials).toBe(newCredentials);
			expect(credential.updatedAt).not.toBeNull();
		});

		it('should return false when credentials remain the same', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			const previousUpdatedAt = credential.updatedAt;
			const result = credential.setCredentials(
				defaultProps.encryptedCredentials,
			);
			expect(result).toBe(false);
			expect(credential.encryptedCredentials).toBe(
				defaultProps.encryptedCredentials,
			);
			expect(credential.updatedAt).toBe(previousUpdatedAt);
		});

		it('should update updatedAt timestamp when credentials change', () => {
			const credential = ProviderCredentialEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				defaultProps,
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			const previousUpdatedAt = credential.updatedAt;
			const newCredentials =
				'updated-iv:updated-encrypted:updated-tag' as const;
			const result = credential.setCredentials(newCredentials);
			expect(result).toBe(true);
			expect(credential.updatedAt).not.toBe(previousUpdatedAt);
			expect(credential.updatedAt).not.toBeNull();
		});
	});

	describe('.setPriority', () => {
		it('should update priority and return true when priority changes', () => {
			const credential = ProviderCredentialEntity.createNew({
				...defaultProps,
				priority: EPriority.Low,
			});
			expect(credential.updatedAt).toBeNull();
			const result = credential.setPriority(EPriority.High);
			expect(result).toBe(true);
			expect(credential.priority).toBe(EPriority.High);
			expect(credential.updatedAt).not.toBeNull();
		});

		it('should return false when priority remains the same', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			const previousUpdatedAt = credential.updatedAt;
			const result = credential.setPriority(defaultProps.priority);
			expect(result).toBe(false);
			expect(credential.priority).toBe(defaultProps.priority);
			expect(credential.updatedAt).toBe(previousUpdatedAt);
		});

		it('should update updatedAt timestamp when priority changes', () => {
			const credential = ProviderCredentialEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				{
					...defaultProps,
					priority: EPriority.Medium,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			const previousUpdatedAt = credential.updatedAt;
			const result = credential.setPriority(EPriority.Low);
			expect(result).toBe(true);
			expect(credential.updatedAt).not.toBe(previousUpdatedAt);
			expect(credential.updatedAt).not.toBeNull();
		});

		it('should handle all priority levels', () => {
			const priorities = [EPriority.High, EPriority.Medium, EPriority.Low];
			const credential = ProviderCredentialEntity.createNew({
				...defaultProps,
				priority: EPriority.High,
			});
			priorities.forEach((priority) => {
				const previousPriority = credential.priority;
				const result = credential.setPriority(priority);
				const expectedResult = priority !== previousPriority;
				expect(result).toBe(expectedResult);
			});
		});
	});

	describe('.toSummary', () => {
		it('should return a summary object with all properties', () => {
			const credential = ProviderCredentialEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				{
					...defaultProps,
					isProduction: true,
				},
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			const summary = credential.toSummary();
			expect(summary).toEqual({
				id: 'cl9v1x5f20000qzrmn5g6z5v3',
				projectId: defaultProps.projectId.toString(),
				provider: defaultProps.provider,
				encryptedCredentials: defaultProps.encryptedCredentials,
				isProduction: true,
				priority: defaultProps.priority,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: new Date('2024-02-01T00:00:00Z'),
			});
		});

		it('should return summary with null updatedAt for new credentials', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			const summary = credential.toSummary();
			expect(summary.updatedAt).toBeNull();
			expect(summary.id).toBe(credential.id.toString());
			expect(summary.projectId).toBe(defaultProps.projectId.toString());
			expect(summary.provider).toBe(defaultProps.provider);
			expect(summary.encryptedCredentials).toBe(
				defaultProps.encryptedCredentials,
			);
			expect(summary.isProduction).toBe(false);
			expect(summary.priority).toBe(defaultProps.priority);
		});

		it('should return summary for production credentials', () => {
			const credential = ProviderCredentialEntity.createNew({
				...defaultProps,
				isProduction: true,
			});
			const summary = credential.toSummary();
			expect(summary.isProduction).toBe(true);
		});
	});

	describe('Getters', () => {
		it('should return correct projectId', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential.projectId).toBe(defaultProps.projectId);
			expect(credential.projectId).toBeInstanceOf(EntityCuid);
		});

		it('should return correct provider', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential.provider).toBe(defaultProps.provider);
		});

		it('should return correct encryptedCredentials', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential.encryptedCredentials).toBe(
				defaultProps.encryptedCredentials,
			);
		});

		it('should return correct isProduction', () => {
			const nonProductionCredential =
				ProviderCredentialEntity.createNew(defaultProps);
			const productionCredential = ProviderCredentialEntity.createNew({
				...defaultProps,
				isProduction: true,
			});
			expect(nonProductionCredential.isProduction).toBe(false);
			expect(productionCredential.isProduction).toBe(true);
		});

		it('should return correct priority', () => {
			const credential = ProviderCredentialEntity.createNew(defaultProps);
			expect(credential.priority).toBe(defaultProps.priority);
		});
	});
});
