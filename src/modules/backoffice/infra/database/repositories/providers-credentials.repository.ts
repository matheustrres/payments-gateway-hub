import { Injectable } from '@nestjs/common';

import { ProviderCredentialMapper } from '../mappers/provider-credential';

import { EPaymentProvider } from '@/core/enums/payment';

import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';
import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlProvidersCredentialsRepository implements IProvidersCredentialsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.providerCredential.delete({
			where: { id },
		});
	}

	async findAll(): Promise<ProviderCredentialEntity[]> {
		const records = await this.dbService.providerCredential.findMany();
		if (!records.length) return [];
		return records.map(ProviderCredentialMapper.toDomain);
	}

	async findAllByProvider(
		provider: EPaymentProvider,
	): Promise<ProviderCredentialEntity[]> {
		const records = await this.dbService.providerCredential.findMany({
			where: { provider },
		});
		if (!records.length) return [];
		return records.map(ProviderCredentialMapper.toDomain);
	}

	async findById(id: string): Promise<ProviderCredentialEntity | null> {
		const record = await this.dbService.providerCredential.findUnique({
			where: { id },
		});
		if (!record) return null;
		return ProviderCredentialMapper.toDomain(record);
	}

	async findByProjectIdAndProvider(
		projectId: string,
		provider: EPaymentProvider,
		isProduction: boolean,
	): Promise<ProviderCredentialEntity | null> {
		const record = await this.dbService.providerCredential.findFirst({
			where: {
				projectId,
				provider,
				isProduction,
			},
		});
		if (!record) return null;
		return ProviderCredentialMapper.toDomain(record);
	}

	async insertOne(entity: ProviderCredentialEntity): Promise<void> {
		const record = ProviderCredentialMapper.toPersistence(entity);
		await this.dbService.providerCredential.create({
			data: record,
		});
	}

	async updateOne(entity: ProviderCredentialEntity): Promise<void> {
		const record = ProviderCredentialMapper.toPersistence(entity);
		await this.dbService.providerCredential.update({
			where: { id: record.id },
			data: record,
		});
	}
}
