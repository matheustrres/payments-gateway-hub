import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { IWebhookProvisioningPort } from '@/modules/backoffice/application/ports/webhook-provisioning.port';
import { UpsertProviderCredentialsUseCase } from '@/modules/backoffice/application/use-cases/upser-provider-credential/upsert-provider-credential.use-case';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';

import { errorMessages } from '@/shared/utils/err-messages';

import { ProjectEntityBuilder } from '#/data/builders/entities/project.entity.builder';
import { ProviderCredentialEntityBuilder } from '#/data/builders/entities/provider-credential.entity.builder';
import { createWebhookProvisioningPortMock } from '#/data/mocks/ports/webhook-provisioning.port';
import { createProjectsRepositoryMock } from '#/data/mocks/repositories/projects.repository';
import { createProvidersCredentialsRepositoryMock } from '#/data/mocks/repositories/providers-credentials.repository';
import { createEncryptionServiceMock } from '#/data/mocks/services/encryption-service';

describe(UpsertProviderCredentialsUseCase.name, () => {
	let sut: UpsertProviderCredentialsUseCase;
	let projectsRepository: Mocked<IProjectsRepository>;
	let providersCredentialsRepository: Mocked<IProvidersCredentialsRepository>;
	let encryptionService: Mocked<IEncryptionServicePort>;
	let webhookProvisioningPort: Mocked<IWebhookProvisioningPort>;

	beforeEach(() => {
		projectsRepository = createProjectsRepositoryMock();
		providersCredentialsRepository = createProvidersCredentialsRepositoryMock();
		encryptionService = createEncryptionServiceMock();
		webhookProvisioningPort = createWebhookProvisioningPortMock();
		sut = new UpsertProviderCredentialsUseCase(
			projectsRepository,
			providersCredentialsRepository,
			encryptionService,
			webhookProvisioningPort,
		);
	});

	describe('Project validation', () => {
		it('should throw if project does not exist', async () => {
			projectsRepository.findById.mockResolvedValue(null);
			const input = {
				projectId: 'non-existent-project-id',
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.High,
			};
			await expect(sut.exec(input)).rejects.toThrow(
				errorMessages.projects.notFound,
			);
			expect(projectsRepository.findById).toHaveBeenCalledWith(input.projectId);
			expect(projectsRepository.findById).toHaveBeenCalledOnce();
		});
	});

	describe('Credentials validation', () => {
		it('should throw if credentials are empty', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: {},
				priority: EPriority.High,
			};
			await expect(sut.exec(input)).rejects.toThrow(
				errorMessages.providersCredentials.emptyCredentials,
			);
			expect(projectsRepository.findById).toHaveBeenCalledWith(input.projectId);
		});

		it('should throw if credentials are null', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: null as any,
				priority: EPriority.High,
			};
			await expect(sut.exec(input)).rejects.toThrow(
				errorMessages.providersCredentials.emptyCredentials,
			);
		});
	});

	describe('Creating new credentials', () => {
		it('should create new credential if none exists', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key', secretKey: 'secret' },
				priority: EPriority.High,
				isProduction: false,
			};
			await sut.exec(input);
			expect(encryptionService.encrypt).toHaveBeenCalledWith(
				JSON.stringify(input.credentials),
			);
			expect(encryptionService.encrypt).toHaveBeenCalledOnce();
			expect(
				providersCredentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledWith(input.projectId, input.provider, false);
			expect(providersCredentialsRepository.insertOne).toHaveBeenCalledOnce();
			const insertedCredential =
				providersCredentialsRepository.insertOne.mock.calls[0]![0];
			expect(insertedCredential).toBeInstanceOf(ProviderCredentialEntity);
			expect(insertedCredential.provider).toBe(input.provider);
			expect(insertedCredential.encryptedCredentials).toBe(encryptedResult);
			expect(insertedCredential.priority).toBe(input.priority);
			expect(insertedCredential.isProduction).toBe(false);
		});

		it('should default isProduction to false if not provided', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.Medium,
			};
			await sut.exec(input);
			expect(
				providersCredentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledWith(input.projectId, input.provider, false);
			const insertedCredential =
				providersCredentialsRepository.insertOne.mock.calls[0]![0];
			expect(insertedCredential.isProduction).toBe(false);
		});

		it('should create production credential when isProduction is true', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'production-api-key' },
				priority: EPriority.High,
				isProduction: true,
			};
			await sut.exec(input);
			expect(
				providersCredentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledWith(input.projectId, input.provider, true);
			const insertedCredential =
				providersCredentialsRepository.insertOne.mock.calls[0]![0];
			expect(insertedCredential.isProduction).toBe(true);
		});
	});

	describe('Updating existing credentials', () => {
		it('should update existing credential with new encrypted credentials', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withProvider(EPaymentProvider.Asaas)
				.withEncryptedCredentials('old:encrypted:data')
				.withPriority(EPriority.Low)
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const oldCredentials = { apiKey: 'old-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(oldCredentials));
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);
			const setCredentialsSpy = vi.spyOn(existingCredential, 'setCredentials');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'new-api-key' },
				priority: EPriority.Medium,
			};
			await sut.exec(input);
			expect(encryptionService.decrypt).toHaveBeenCalledWith(
				'old:encrypted:data',
			);
			expect(encryptionService.encrypt).toHaveBeenCalledWith(
				JSON.stringify(input.credentials),
			);
			expect(setCredentialsSpy).toHaveBeenCalledWith(newEncryptedResult);
			expect(setCredentialsSpy).toHaveBeenCalledOnce();
			expect(setCredentialsSpy).toHaveReturnedWith(true);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledOnce();
			expect(providersCredentialsRepository.insertOne).not.toHaveBeenCalled();
		});

		it('should update priority if provided', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.Low)
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const oldCredentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(oldCredentials));
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);
			const setPrioritySpy = vi.spyOn(existingCredential, 'setPriority');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.High,
			};
			await sut.exec(input);
			expect(setPrioritySpy).toHaveBeenCalledWith(EPriority.High);
			expect(setPrioritySpy).toHaveBeenCalledOnce();
			expect(setPrioritySpy).toHaveReturnedWith(true);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});

		it('should call setPriority even if priority is undefined', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.Low)
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const oldCredentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(oldCredentials));
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);
			const setPrioritySpy = vi.spyOn(existingCredential, 'setPriority');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: undefined as any,
			};
			await sut.exec(input);
			expect(setPrioritySpy).toHaveBeenCalledWith(undefined);
			expect(setPrioritySpy).toHaveBeenCalledOnce();
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});

		it('should update only credentials when priority remains the same', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.High)
				.withEncryptedCredentials('old:encrypted:data')
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const oldCredentials = { apiKey: 'old-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(oldCredentials));
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);
			const setCredentialsSpy = vi.spyOn(existingCredential, 'setCredentials');
			const setPrioritySpy = vi.spyOn(existingCredential, 'setPriority');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'new-api-key' },
				priority: EPriority.High,
			};
			await sut.exec(input);
			expect(setCredentialsSpy).toHaveBeenCalledWith(newEncryptedResult);
			expect(setCredentialsSpy).toHaveReturnedWith(true);
			expect(setPrioritySpy).toHaveBeenCalledWith(EPriority.High);
			expect(setPrioritySpy).toHaveReturnedWith(false);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});
	});

	describe('Encryption behavior', () => {
		it('should encrypt credentials as JSON string', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv:encrypted:tag';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			const credentials = {
				apiKey: 'test-api-key',
				secretKey: 'secret',
				webhookSecret: 'webhook-secret',
			};
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.Medium,
			};
			await sut.exec(input);
			expect(encryptionService.encrypt).toHaveBeenCalledWith(
				JSON.stringify(credentials),
			);
		});
	});

	describe('Credentials comparison and optimization', () => {
		it('should not update when credentials are identical', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.Medium)
				.withEncryptedCredentials('old:encrypted:data')
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const credentials = { apiKey: 'test-api-key', secretKey: 'secret' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(credentials));
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.Medium,
			};
			await sut.exec(input);
			expect(encryptionService.decrypt).toHaveBeenCalledWith(
				'old:encrypted:data',
			);
			expect(encryptionService.encrypt).not.toHaveBeenCalled();
			expect(providersCredentialsRepository.updateOne).not.toHaveBeenCalled();
		});

		it('should handle decryption failure and force update', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.Medium)
				.withEncryptedCredentials('corrupted:encrypted:data')
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			encryptionService.decrypt.mockImplementation(() => {
				throw new Error('Decryption failed');
			});
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);
			const loggerWarnSpy = vi
				.spyOn(sut['logger'], 'warn')
				.mockImplementation(() => {});
			const setCredentialsSpy = vi.spyOn(existingCredential, 'setCredentials');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'new-api-key' },
				priority: EPriority.Medium,
			};
			await sut.exec(input);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				'Failed to decrypt existing credentials for comparison. Forcing update.',
				expect.any(Error),
			);
			expect(encryptionService.encrypt).toHaveBeenCalledWith(
				JSON.stringify(input.credentials),
			);
			expect(setCredentialsSpy).toHaveBeenCalledWith(newEncryptedResult);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});

		it('should update when only priority changes', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withPriority(EPriority.Low)
				.withEncryptedCredentials('old:encrypted:data')
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const credentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(credentials));
			const setPrioritySpy = vi.spyOn(existingCredential, 'setPriority');
			const setCredentialsSpy = vi.spyOn(existingCredential, 'setCredentials');
			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.High,
			};
			await sut.exec(input);
			expect(encryptionService.decrypt).toHaveBeenCalledWith(
				'old:encrypted:data',
			);
			expect(encryptionService.encrypt).not.toHaveBeenCalled();
			expect(setCredentialsSpy).not.toHaveBeenCalled();
			expect(setPrioritySpy).toHaveBeenCalledWith(EPriority.High);
			expect(setPrioritySpy).toHaveReturnedWith(true);
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});
	});

	describe('Webhook provisioning', () => {
		it('should provision webhook for Asaas when creating new credentials', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockResolvedValue({
				webhookId: 'webhook_123',
				webhookUrl: 'https://api.example.com/webhooks/inbound/proj_123/asaas',
			});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.High,
				isProduction: false,
			};

			await sut.exec(input);

			expect(webhookProvisioningPort.supports).toHaveBeenCalledWith(
				EPaymentProvider.Asaas,
			);
			expect(webhookProvisioningPort.provision).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				projectId: input.projectId,
				isSandbox: true,
			});
			expect(providersCredentialsRepository.insertOne).toHaveBeenCalledOnce();
		});

		it('should not provision webhook for unsupported providers', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			webhookProvisioningPort.supports.mockReturnValue(false);

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.AbacatePay,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.High,
			};

			await sut.exec(input);

			expect(webhookProvisioningPort.supports).toHaveBeenCalledWith(
				EPaymentProvider.AbacatePay,
			);
			expect(webhookProvisioningPort.provision).not.toHaveBeenCalled();
			expect(providersCredentialsRepository.insertOne).toHaveBeenCalledOnce();
		});

		it('should use production mode when isProduction is true', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockResolvedValue({
				webhookId: 'webhook_prod_123',
				webhookUrl: 'https://api.example.com/webhooks/inbound/proj_123/asaas',
			});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'prod-api-key' },
				priority: EPriority.High,
				isProduction: true,
			};

			await sut.exec(input);

			expect(webhookProvisioningPort.provision).toHaveBeenCalledWith({
				apiKey: 'prod-api-key',
				projectId: input.projectId,
				isSandbox: false,
			});
		});

		it('should not fail credential creation if webhook provisioning fails', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockRejectedValue(
				new Error('Webhook provisioning failed'),
			);

			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'test-api-key' },
				priority: EPriority.High,
			};

			await expect(sut.exec(input)).resolves.not.toThrow();

			expect(providersCredentialsRepository.insertOne).toHaveBeenCalledOnce();
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to provision webhook for project'),
				expect.any(String),
			);
		});

		it('should not provision webhook if apiKey is not found in credentials', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				null,
			);
			const encryptedResult = 'iv123:encrypted456:tag789';
			encryptionService.encrypt.mockReturnValue(encryptedResult);
			webhookProvisioningPort.supports.mockReturnValue(true);

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { someOtherKey: 'value' },
				priority: EPriority.High,
			};

			await sut.exec(input);

			expect(webhookProvisioningPort.provision).not.toHaveBeenCalled();
			expect(providersCredentialsRepository.insertOne).toHaveBeenCalledOnce();
		});

		it('should not provision webhook when updating existing credentials without environment change', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withProvider(EPaymentProvider.Asaas)
				.withEncryptedCredentials('old:encrypted:data')
				.withPriority(EPriority.Low)
				.withIsProduction(false)
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const oldCredentials = { apiKey: 'old-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(oldCredentials));
			const newEncryptedResult = 'new:encrypted:credentials';
			encryptionService.encrypt.mockReturnValue(newEncryptedResult);

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials: { apiKey: 'new-api-key' },
				priority: EPriority.Medium,
				isProduction: false, // Same as existing
			};

			await sut.exec(input);

			expect(webhookProvisioningPort.provision).not.toHaveBeenCalled();
			expect(providersCredentialsRepository.updateOne).toHaveBeenCalledWith(
				existingCredential,
			);
		});

		it('should provision webhook when environment changes from sandbox to production', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withProvider(EPaymentProvider.Asaas)
				.withEncryptedCredentials('old:encrypted:data')
				.withPriority(EPriority.High)
				.withIsProduction(false) // Currently sandbox
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const credentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(credentials));
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockResolvedValue({
				webhookId: 'webhook_prod_new',
				webhookUrl: 'https://api.example.com/webhooks/inbound/proj_123/asaas',
			});

			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.High,
				isProduction: true, // Changing to production
			};

			await sut.exec(input);

			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('Webhook provisioned successfully'),
			);
			expect(webhookProvisioningPort.provision).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				projectId: input.projectId,
				isSandbox: false,
			});
			expect(webhookProvisioningPort.provision).toHaveBeenCalledOnce();
		});

		it('should provision webhook when environment changes from production to sandbox', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withProvider(EPaymentProvider.Asaas)
				.withEncryptedCredentials('old:encrypted:data')
				.withPriority(EPriority.High)
				.withIsProduction(true) // Currently production
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const credentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(credentials));
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockResolvedValue({
				webhookId: 'webhook_sandbox_new',
				webhookUrl: 'https://api.example.com/webhooks/inbound/proj_123/asaas',
			});

			const loggerLogSpy = vi
				.spyOn(sut['logger'], 'log')
				.mockImplementation(() => {});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.High,
				isProduction: false, // Changing to sandbox
			};

			await sut.exec(input);

			expect(loggerLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('Webhook provisioned successfully'),
			);
			expect(webhookProvisioningPort.provision).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				projectId: input.projectId,
				isSandbox: true,
			});
			expect(webhookProvisioningPort.provision).toHaveBeenCalledOnce();
		});

		it('should not fail update if webhook provisioning fails on environment change', async () => {
			const project = new ProjectEntityBuilder().build();
			projectsRepository.findById.mockResolvedValue(project);
			const existingCredential = new ProviderCredentialEntityBuilder()
				.withProjectId(EntityCuid.createFrom(project.id.toString()))
				.withProvider(EPaymentProvider.Asaas)
				.withEncryptedCredentials('old:encrypted:data')
				.withPriority(EPriority.High)
				.withIsProduction(false)
				.build();
			providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				existingCredential,
			);
			const credentials = { apiKey: 'test-api-key' };
			encryptionService.decrypt.mockReturnValue(JSON.stringify(credentials));
			webhookProvisioningPort.supports.mockReturnValue(true);
			webhookProvisioningPort.provision.mockRejectedValue(
				new Error('Webhook provisioning failed'),
			);

			const loggerErrorSpy = vi
				.spyOn(sut['logger'], 'error')
				.mockImplementation(() => {});

			const input = {
				projectId: project.id.toString(),
				provider: EPaymentProvider.Asaas,
				providerId: 'provider-id',
				credentials,
				priority: EPriority.High,
				isProduction: true,
			};

			await expect(sut.exec(input)).resolves.not.toThrow();

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to provision webhook for project'),
				expect.any(String),
			);
		});
	});
});
