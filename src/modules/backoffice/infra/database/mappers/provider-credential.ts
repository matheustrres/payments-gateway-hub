import { ProviderCredential } from '@prisma/client';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';
import { EncryptedCredentials } from '@/core/types';

import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

export class ProviderCredentialMapper {
	static toDomain(raw: ProviderCredential): ProviderCredentialEntity {
		return ProviderCredentialEntity.createFrom(
			raw.id,
			{
				encryptedCredentials: raw.encryptedCredentials as EncryptedCredentials,
				isProduction: raw.isProduction,
				provider: raw.provider as EPaymentProvider,
				projectId: EntityCuid.createFrom(raw.projectId),
				priority: raw.priority as EPriority,
			},
			{
				createdAt: raw.createdAt,
				updatedAt: raw.updatedAt,
			},
		);
	}

	static toPersistence(entity: ProviderCredentialEntity): ProviderCredential {
		return entity.toSummary();
	}
}
