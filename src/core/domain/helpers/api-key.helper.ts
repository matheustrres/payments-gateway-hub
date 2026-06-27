import {
	API_KEY_DEVELOPMENT_PREFIX,
	API_KEY_PRODUCTION_PREFIX,
} from '@/core/domain/consts/api-key-prefix';
import { ApiKeyEnvironment } from '@/core/domain/types/api-key-pair';

export class ApiKeyHelper {
	/**
	 * Determina se uma chave de API é de produção baseada no seu prefixo
	 * @param apiKey - A chave de API (ex: sk_live_xxx ou sk_test_xxx)
	 * @returns true se for chave de produção (sk_live_), false se for chave de teste (sk_test_)
	 */
	static isProduction(apiKey: string): boolean {
		if (apiKey.startsWith(API_KEY_PRODUCTION_PREFIX)) {
			return true;
		}
		if (apiKey.startsWith(API_KEY_DEVELOPMENT_PREFIX)) {
			return false;
		}
		throw new Error(
			`Invalid API key format. Expected prefix ${API_KEY_PRODUCTION_PREFIX} or ${API_KEY_DEVELOPMENT_PREFIX}`,
		);
	}

	/**
	 * Determina o ambiente (test ou live) baseado no prefixo da chave
	 * @param apiKey - A chave de API
	 * @returns 'live' ou 'test'
	 */
	static getEnvironment(apiKey: string): ApiKeyEnvironment {
		return this.isProduction(apiKey) ? 'live' : 'test';
	}
}
