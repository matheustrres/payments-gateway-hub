import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';
import { EncryptedCredentials } from '@/core/types';

import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

type ProviderCredentialEntityBuilderProps = {
	projectId: EntityCuid;
	provider: EPaymentProvider;
	encryptedCredentials: EncryptedCredentials;
	isProduction: boolean;
	priority: EPriority;
};

export class ProviderCredentialEntityBuilder {
	#props: ProviderCredentialEntityBuilderProps = {
		projectId: EntityCuid.create(),
		provider: EPaymentProvider.Asaas,
		encryptedCredentials: 'iv:ciphertext:authTag',
		isProduction: false,
		priority: EPriority.Medium,
	};

	constructor(props?: Partial<ProviderCredentialEntityBuilderProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withProjectId(projectId: EntityCuid): this {
		this.#props.projectId = projectId;
		return this;
	}

	withProvider(provider: EPaymentProvider): this {
		this.#props.provider = provider;
		return this;
	}

	withEncryptedCredentials(encryptedCredentials: EncryptedCredentials): this {
		this.#props.encryptedCredentials = encryptedCredentials;
		return this;
	}

	withIsProduction(isProduction: boolean): this {
		this.#props.isProduction = isProduction;
		return this;
	}

	withPriority(priority: EPriority): this {
		this.#props.priority = priority;
		return this;
	}

	build(): ProviderCredentialEntity {
		return ProviderCredentialEntity.createNew(this.#props);
	}

	buildProps(): ProviderCredentialEntityBuilderProps {
		return { ...this.#props };
	}
}
