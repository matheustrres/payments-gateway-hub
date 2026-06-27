import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';
import { EPaymentProvider } from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';
import { EncryptedCredentials, Optional } from '@/core/types';

export class ProviderCredentialEntity extends UpdatableEntity<ProviderCredentialEntityProps> {
	private constructor(props: ProviderCredentialConstructorProps) {
		super(props);
	}

	static createNew(
		props: CreateProviderCredentialProps,
	): ProviderCredentialEntity {
		return new ProviderCredentialEntity({
			id: EntityCuid.create(),
			props: {
				...props,
				isProduction: props.isProduction ?? false,
			},
		});
	}

	static createFrom(
		id: string,
		props: ProviderCredentialEntityProps,
		meta?: EntityMeta,
	): ProviderCredentialEntity {
		return new ProviderCredentialEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get projectId(): EntityId {
		return this.props.projectId;
	}

	get provider(): EPaymentProvider {
		return this.props.provider;
	}

	get encryptedCredentials(): EncryptedCredentials {
		return this.props.encryptedCredentials;
	}

	get isProduction(): boolean {
		return this.props.isProduction;
	}

	get priority(): EPriority {
		return this.props.priority;
	}

	setCredentials(encryptedCredentials: EncryptedCredentials): boolean {
		if (this.props.encryptedCredentials !== encryptedCredentials) {
			this.props.encryptedCredentials = encryptedCredentials;
			this.touch();
			return true;
		}
		return false;
	}

	setPriority(priority: EPriority): boolean {
		if (this.props.priority !== priority) {
			this.props.priority = priority;
			this.touch();
			return true;
		}
		return false;
	}

	toSummary(): ProviderCredentialSummary {
		return {
			id: this.id.toString(),
			projectId: this.props.projectId.toString(),
			provider: this.props.provider,
			encryptedCredentials: this.props.encryptedCredentials,
			isProduction: this.props.isProduction,
			priority: this.props.priority,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}

type ProviderCredentialConstructorProps =
	CreateEntityProps<ProviderCredentialEntityProps>;

type ProviderCredentialEntityProps = {
	projectId: EntityId;
	provider: EPaymentProvider;
	encryptedCredentials: EncryptedCredentials;
	isProduction: boolean;
	priority: EPriority;
};

type CreateProviderCredentialProps = Optional<
	ProviderCredentialEntityProps,
	'isProduction'
>;

export type ProviderCredentialSummary = {
	id: string;
	projectId: string;
	provider: string;
	encryptedCredentials: EncryptedCredentials;
	isProduction: boolean;
	priority: number;
	createdAt: Date;
	updatedAt: Date | null;
};
