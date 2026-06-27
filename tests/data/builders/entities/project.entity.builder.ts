import {
	ApiKeyEnvironment,
	ApiKeyPair,
} from '@/core/domain/types/api-key-pair';

import {
	ProjectEntity,
	ProjectEntityProps,
} from '@/modules/backoffice/domain/entities/project.entity';

export class ProjectEntityBuilder {
	#props: ProjectEntityProps = {
		testApiKeyHash: 'default_test_hash',
		testApiKeyPrefix: 'sk_test_abcd',
		liveApiKeyHash: 'default_live_hash',
		liveApiKeyPrefix: 'sk_live_abcd',
		name: 'Default Project Name',
		isActive: true,
		webhookUrl: 'https://example.com/webhook',
	};

	constructor(props?: Partial<ProjectEntityProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withName(name: string): ProjectEntityBuilder {
		this.#props.name = name;
		return this;
	}

	/**
	 * Define a chave de API para um ambiente específico
	 * @param environment - 'test' ou 'live'
	 * @param apiKey - Par de hash e prefix
	 */
	withApiKey(
		environment: ApiKeyEnvironment,
		apiKey: ApiKeyPair,
	): ProjectEntityBuilder {
		this.#props[`${environment}ApiKeyHash`] = apiKey.hash;
		this.#props[`${environment}ApiKeyPrefix`] = apiKey.prefix;
		return this;
	}

	withTestApiKey(hash: string, prefix: string): ProjectEntityBuilder {
		return this.withApiKey('test', { hash, prefix });
	}

	withLiveApiKey(hash: string, prefix: string): ProjectEntityBuilder {
		return this.withApiKey('live', { hash, prefix });
	}

	withTestApiKeyHash(testApiKeyHash: string): ProjectEntityBuilder {
		this.#props.testApiKeyHash = testApiKeyHash;
		return this;
	}

	withTestApiKeyPrefix(testApiKeyPrefix: string): ProjectEntityBuilder {
		this.#props.testApiKeyPrefix = testApiKeyPrefix;
		return this;
	}

	withLiveApiKeyHash(liveApiKeyHash: string): ProjectEntityBuilder {
		this.#props.liveApiKeyHash = liveApiKeyHash;
		return this;
	}

	withLiveApiKeyPrefix(liveApiKeyPrefix: string): ProjectEntityBuilder {
		this.#props.liveApiKeyPrefix = liveApiKeyPrefix;
		return this;
	}

	withIsActive(isActive: boolean): ProjectEntityBuilder {
		this.#props.isActive = isActive;
		return this;
	}

	withWebhookUrl(webhookUrl: string): ProjectEntityBuilder {
		this.#props.webhookUrl = webhookUrl;
		return this;
	}

	build(): ProjectEntity {
		return ProjectEntity.createNew(this.#props);
	}
}
