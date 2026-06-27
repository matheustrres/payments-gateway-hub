import crypto from 'node:crypto';

import {
	API_KEY_DEVELOPMENT_PREFIX,
	API_KEY_PRODUCTION_PREFIX,
} from '@/core/domain/consts/api-key-prefix';

export type ApiKeyGenerated = {
	plainStr: string; // sk_live_*****
	hashStr: string; // a5f5c6e7d8...
	prefixStr: string; // sk_live_*****
};

export class ApiKeyGenService {
	private static readonly BYTES_ENTROPY = 24; // 24 bytes = 192 bits
	private static readonly ALGORITHM = 'sha256';
	private static readonly VISIBLE_CHARS = 4;

	static generate(environment: 'live' | 'test' = 'live'): ApiKeyGenerated {
		const prefix =
			environment === 'live'
				? API_KEY_PRODUCTION_PREFIX
				: API_KEY_DEVELOPMENT_PREFIX;
		const randomBytes = crypto.randomBytes(this.BYTES_ENTROPY).toString('hex');
		const plainStr = `${prefix}${randomBytes}`;
		const hashStr = this.createHash(plainStr);
		const storagePrefix = plainStr.slice(0, prefix.length + this.VISIBLE_CHARS);
		return {
			plainStr, // Exibe uma única vez
			hashStr, // Armazena o hash
			prefixStr: storagePrefix, // Para logs/exibição
		};
	}

	static createHash(plainKey: string): string {
		return crypto.createHash(this.ALGORITHM).update(plainKey).digest('hex');
	}

	static validate(inputKey: string, storedHash: string): boolean {
		const inputHash = this.createHash(inputKey);
		const bufferInput = Buffer.from(inputHash, 'utf-8');
		const bufferStored = Buffer.from(storedHash, 'utf-8');
		if (bufferInput.length !== bufferStored.length) {
			return false;
		}
		return crypto.timingSafeEqual(bufferInput, bufferStored);
	}
}
