import {
	CreateEntityProps,
	EntityMeta,
	UpdatableEntity,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { DomainException } from '@/core/domain/exceptions/domain-exception';
import {
	ApiKeyEnvironment,
	ApiKeyPair,
	ProjectApiKeys,
} from '@/core/domain/types/api-key-pair';
import { ENodeEnv } from '@/core/enums/node-env';

export class ProjectEntity extends UpdatableEntity<ProjectEntityProps> {
	private constructor(props: ProjectEntityConstructor) {
		super(props);
	}

	static createNew(props: ProjectEntityProps): ProjectEntity {
		const isTesting = process.env['NODE_ENV'] === ENodeEnv.Testing;
		const isValidWebhookUrl =
			!props.webhookUrl ||
			props.webhookUrl.startsWith('https://') ||
			(isTesting && props.webhookUrl.startsWith('http://'));
		if (!isValidWebhookUrl) {
			throw new DomainException('webhookUrl must start with https://');
		}
		return new ProjectEntity({
			id: EntityCuid.create(),
			props,
		});
	}

	static createFrom(
		id: string,
		props: ProjectEntityProps,
		meta?: EntityMeta,
	): ProjectEntity {
		return new ProjectEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get name(): string {
		return this.props.name;
	}

	get isActive(): boolean {
		return this.props.isActive;
	}

	/**
	 * Retorna as chaves de API do projeto de forma estruturada
	 */
	get apiKeys(): ProjectApiKeys {
		return {
			test: {
				hash: this.props.testApiKeyHash,
				prefix: this.props.testApiKeyPrefix,
			},
			live: {
				hash: this.props.liveApiKeyHash,
				prefix: this.props.liveApiKeyPrefix,
			},
		};
	}

	/**
	 * Retorna a chave de API (hash e prefix) para o ambiente especificado
	 * @param environment - 'test' ou 'live'
	 */
	getApiKeyByEnvironment(environment: ApiKeyEnvironment): ApiKeyPair {
		return this.apiKeys[environment];
	}

	/**
	 * Retorna o hash da chave de API para o ambiente especificado
	 * @param environment - 'test' ou 'live'
	 */
	getApiKeyHash(environment: ApiKeyEnvironment): string {
		return this.getApiKeyByEnvironment(environment).hash;
	}

	/**
	 * Retorna o prefix da chave de API para o ambiente especificado
	 * @param environment - 'test' ou 'live'
	 */
	getApiKeyPrefix(environment: ApiKeyEnvironment): string {
		return this.getApiKeyByEnvironment(environment).prefix;
	}

	get testApiKeyPrefix(): string {
		return this.props.testApiKeyPrefix;
	}

	get liveApiKeyPrefix(): string {
		return this.props.liveApiKeyPrefix;
	}

	get webhookUrl(): string {
		return this.props.webhookUrl;
	}

	get adminId(): string {
		return this.props.adminId;
	}

	activate(): void {
		if (this.props.isActive) return;
		this.props.isActive = true;
		this.touch();
	}

	deactivate(): void {
		if (!this.props.isActive) return;
		this.props.isActive = false;
		this.touch();
	}

	toSummary(): ProjectSummary {
		return {
			id: this.id.toString(),
			name: this.props.name,
			isActive: this.props.isActive,
			testApiKeyHash: this.props.testApiKeyHash,
			testApiKeyPrefix: this.props.testApiKeyPrefix,
			liveApiKeyHash: this.props.liveApiKeyHash,
			liveApiKeyPrefix: this.props.liveApiKeyPrefix,
			webhookUrl: this.props.webhookUrl,
			adminId: this.props.adminId,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}

type ProjectEntityConstructor = CreateEntityProps<ProjectEntityProps>;

export type ProjectEntityProps = {
	name: string;
	isActive: boolean;
	testApiKeyHash: string;
	testApiKeyPrefix: string;
	liveApiKeyHash: string;
	liveApiKeyPrefix: string;
	webhookUrl: string;
	adminId: string;
};

export type ProjectSummary = {
	id: string;
	name: string;
	isActive: boolean;
	testApiKeyHash: string;
	testApiKeyPrefix: string;
	liveApiKeyHash: string;
	liveApiKeyPrefix: string;
	webhookUrl: string;
	adminId: string;
	createdAt: Date;
	updatedAt: Date | null;
};
