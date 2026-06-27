import {
	CipherGCMTypes,
	createCipheriv,
	createDecipheriv,
	randomBytes,
} from 'node:crypto';

import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';

import { EncryptedCredentials } from '@/core/types';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';

import { EnvService } from '@/shared/modules/env/env.service';
import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class AesEncryptionServiceAdapter implements IEncryptionServicePort {
	private readonly logger = new Logger(AesEncryptionServiceAdapter.name);

	private readonly ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
	private readonly IV_LENGTH = 16;
	private readonly MASTER_KEY: Buffer;

	constructor(private readonly envService: EnvService) {
		const masterKey = this.envService.getKey('ENCRYPTION_MASTER_KEY');
		this.MASTER_KEY = Buffer.from(masterKey, 'hex');
		if (this.MASTER_KEY.length !== 32) {
			throw new BadRequestException(
				`APP_MASTER_KEY must be exactly 32 bytes (64 hex chars). Current length: ${this.MASTER_KEY.length}`,
			);
		}
	}

	/**
	 * Descriptografa credenciais sensíveis validando sua integridade.
	 * @description
	 * Utiliza uma instância `Decipher`. O ponto crítico do modo GCM é o `setAuthTag`:
	 * ele injeta a assinatura digital gerada na encriptação. Ao tentar finalizar (`final`),
	 * o algoritmo verifica matematicamente se o conteúdo foi adulterado.
	 * @param encryptedText - String no formato `iv:ciphertext:authtag`.
	 * @returns O texto plano original (UTF-8).
	 * @throws InternalServerErrorException Se a AuthTag não bater (dado corrompido) ou chave incorreta.
	 */
	decrypt(encryptedText: EncryptedCredentials): string {
		try {
			const [ivHex, encryptedHex, authTagHex] = encryptedText.split(':');
			if (!ivHex || !encryptedHex || !authTagHex) {
				throw new BadRequestException(errorMessages.encryption.invalidFormat);
			}
			const decipher = createDecipheriv(
				this.ALGORITHM,
				this.MASTER_KEY,
				Buffer.from(ivHex, 'hex'),
			);
			// Define a tag de autenticação esperada antes de decifrar
			decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
			let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
			decrypted += decipher.final('utf8'); // Lança erro se a tag for inválida
			return decrypted;
		} catch (error) {
			this.logger.error('Decryption failed:', error);
			throw new InternalServerErrorException(
				errorMessages.encryption.decryptionFailed,
			);
		}
	}

	/**
	 * Criptografa texto plano gerando proteção de confidencialidade e integridade.
	 * @description
	 * Utiliza uma instância `Cipher` com AES-256-GCM.
	 * 1. Gera um IV (Vetor de Inicialização) aleatório para garantir que dados iguais gerem hashes diferentes.
	 * 2. Calcula automaticamente uma `AuthTag` (Tag de Autenticação) durante o processamento,
	 * que serve como uma assinatura digital para validar que o dado não foi alterado no banco.
	 * @param plainText - O texto sensível a ser protegido.
	 * @returns String formatada contendo `iv:ciphertext:authtag`.
	 */
	encrypt(plainText: string): EncryptedCredentials {
		try {
			const iv = randomBytes(this.IV_LENGTH);
			const cipher = createCipheriv(this.ALGORITHM, this.MASTER_KEY, iv);
			let encrypted = cipher.update(plainText, 'utf8', 'hex');
			encrypted += cipher.final('hex');
			// Extrai a tag de integridade gerada pelo algoritmo GCM
			const authTag = cipher.getAuthTag().toString('hex');
			return `${iv.toString('hex')}:${encrypted}:${authTag}`;
		} catch (error) {
			this.logger.error('Encryption failed:', error);
			throw new InternalServerErrorException(
				errorMessages.encryption.encryptionFailed,
			);
		}
	}
}
