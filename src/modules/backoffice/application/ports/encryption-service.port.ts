import { EncryptedCredentials } from '@/core/types';

export abstract class IEncryptionServicePort {
	abstract decrypt(encryptedText: EncryptedCredentials): string;
	abstract encrypt(plainText: string): EncryptedCredentials;
}
