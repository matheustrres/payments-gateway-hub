/**
 * Representa um par de hash e prefix de uma chave de API
 */
export type ApiKeyPair = {
	hash: string;
	prefix: string;
};

/**
 * Representa as chaves de API de um projeto (test e live)
 */
export type ProjectApiKeys = {
	test: ApiKeyPair;
	live: ApiKeyPair;
};

/**
 * Ambiente da chave de API
 */
export type ApiKeyEnvironment = 'test' | 'live';
