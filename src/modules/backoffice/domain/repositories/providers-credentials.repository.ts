import { ProviderCredentialEntity } from '../entities/provider-credential.entity';

import { IRepository } from '@/core/domain/repository';
import { EPaymentProvider } from '@/core/enums/payment';

export abstract class IProvidersCredentialsRepository extends IRepository<ProviderCredentialEntity> {
	abstract findByProjectIdAndProvider(
		projectId: string,
		provider: EPaymentProvider,
		isProduction: boolean,
	): Promise<ProviderCredentialEntity | null>;
	abstract findAllByProvider(
		provider: EPaymentProvider,
	): Promise<ProviderCredentialEntity[]>;
}
