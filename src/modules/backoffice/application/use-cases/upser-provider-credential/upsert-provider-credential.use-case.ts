import { isDeepStrictEqual } from 'node:util';

import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';

import {
	UpsertProviderCredentialsUseCaseInput,
	UpsertProviderCredentialsUseCaseOutput,
} from '../dtos/upsert-provider-credential.dto';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EncryptedCredentials } from '@/core/types';
import { IUseCase } from '@/core/use-case';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { IWebhookProvisioningPort } from '@/modules/backoffice/application/ports/webhook-provisioning.port';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';

import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class UpsertProviderCredentialsUseCase implements IUseCase<
	UpsertProviderCredentialsUseCaseInput,
	UpsertProviderCredentialsUseCaseOutput
> {
	private readonly logger = new Logger(UpsertProviderCredentialsUseCase.name);

	constructor(
		private readonly projectsRepository: IProjectsRepository,
		private readonly providersCredentialsRepository: IProvidersCredentialsRepository,
		private readonly encryptionService: IEncryptionServicePort,
		private readonly webhookProvisioningPort: IWebhookProvisioningPort,
	) {}

	async exec(input: UpsertProviderCredentialsUseCaseInput): Promise<void> {
		await this.ensureProjectExists(input.projectId);
		this.ensureCredentialsAreValid(input.credentials);
		const existingCredential =
			await this.providersCredentialsRepository.findByProjectIdAndProvider(
				input.projectId,
				input.provider,
				input.isProduction ?? false,
			);
		if (!existingCredential) {
			await this.handleCredentialsCreation(input);
			return;
		}
		await this.handleCredentialsUpdate(existingCredential, input);
		return;
	}

	private async ensureProjectExists(projectId: string): Promise<void> {
		const project = await this.projectsRepository.findById(projectId);
		if (!project) {
			throw new NotFoundException(errorMessages.projects.notFound);
		}
	}

	private ensureCredentialsAreValid(
		credentials: Record<string, unknown>,
	): void {
		if (!credentials || !Object.keys(credentials).length) {
			throw new BadRequestException(
				errorMessages.providersCredentials.emptyCredentials,
			);
		}
	}

	private encryptCredentials(
		credentials: Record<string, unknown>,
	): EncryptedCredentials {
		const credentialsJson = JSON.stringify(credentials);
		return this.encryptionService.encrypt(credentialsJson);
	}

	private async handleCredentialsCreation(
		input: UpsertProviderCredentialsUseCaseInput,
	): Promise<void> {
		const encryptedCredentials = this.encryptCredentials(input.credentials);
		const newCredential = ProviderCredentialEntity.createNew({
			...input,
			encryptedCredentials,
			projectId: EntityCuid.createFrom(input.projectId),
			isProduction: input.isProduction,
		});
		await this.providersCredentialsRepository.insertOne(newCredential);
		await this.provisionWebhookIfSupported(input);
	}

	private async provisionWebhookIfSupported(
		input: UpsertProviderCredentialsUseCaseInput,
	): Promise<void> {
		if (!this.webhookProvisioningPort.supports(input.provider)) return;
		try {
			const apiKey = this.extractApiKeyFromCredentials(input.credentials);
			if (!apiKey) return;
			const webhookSecret = this.extractWebhookSecretFromCredentials(
				input.credentials,
			);
			const result = await this.webhookProvisioningPort.provision({
				apiKey,
				projectId: input.projectId,
				isSandbox: !(input.isProduction ?? false),
				webhookSecret,
			});
			this.logger.log(
				`Webhook provisioned successfully for project ${input.projectId}. Webhook ID: ${result.webhookId}, URL: ${result.webhookUrl}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to provision webhook for project ${input.projectId} and provider ${input.provider}. Credentials were saved successfully, but webhook needs manual configuration.`,
				error instanceof Error ? error.stack : error,
			);
		}
	}

	private extractApiKeyFromCredentials(
		credentials: Record<string, unknown>,
	): string | null {
		const possibleKeys = ['apiKey', 'api_key', 'accessToken', 'access_token'];
		for (const key of possibleKeys) {
			const value = credentials[key];
			if (typeof value === 'string' && value.length > 0) {
				return value;
			}
		}
		return null;
	}

	private extractWebhookSecretFromCredentials(
		credentials: Record<string, unknown>,
	): string | undefined {
		const possibleKeys = ['webhookSecret', 'webhook_secret'];
		for (const key of possibleKeys) {
			const value = credentials[key];
			if (typeof value === 'string' && value.length > 0) {
				return value;
			}
		}
		return undefined;
	}

	private async handleCredentialsUpdate(
		credential: ProviderCredentialEntity,
		input: UpsertProviderCredentialsUseCaseInput,
	): Promise<void> {
		let hasChanges = false;
		const newEncryptedCredentials = this.resolveNewCredentialsIfChanged(
			credential,
			input.credentials,
		);
		if (newEncryptedCredentials) {
			hasChanges =
				credential.setCredentials(newEncryptedCredentials) || hasChanges;
		}
		hasChanges = credential.setPriority(input.priority) || hasChanges;
		if (hasChanges) {
			await this.providersCredentialsRepository.updateOne(credential);
		}
		const environmentChanged =
			credential.isProduction !== (input.isProduction ?? false);
		if (environmentChanged) {
			await this.provisionWebhookIfSupported(input);
		}
	}

	private resolveNewCredentialsIfChanged(
		credential: ProviderCredentialEntity,
		newCredentialsPlain: Record<string, unknown>,
	): EncryptedCredentials | null {
		try {
			const storedPlainJson = this.encryptionService.decrypt(
				credential.encryptedCredentials,
			);
			const storedObj = JSON.parse(storedPlainJson);
			const areEqual = isDeepStrictEqual(storedObj, newCredentialsPlain);
			if (areEqual) return null;
			return this.encryptCredentials(newCredentialsPlain);
		} catch (error) {
			this.logger.warn(
				'Failed to decrypt existing credentials for comparison. Forcing update.',
				error,
			);
			return this.encryptCredentials(newCredentialsPlain);
		}
	}
}
