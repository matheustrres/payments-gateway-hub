import { randomBytes } from 'node:crypto';

import {
	BadRequestException,
	InternalServerErrorException,
} from '@nestjs/common';

import { AesEncryptionServiceAdapter } from '@/modules/backoffice/infra/adapters/encryption-service/aes-encryption-service.adapter';

import { EnvService } from '@/shared/modules/env/env.service';

describe('AesEncryptionServiceAdapter (Integration)', () => {
	let sut: AesEncryptionServiceAdapter;
	let envService: EnvService;

	const VALID_MASTER_KEY = randomBytes(32).toString('hex');

	beforeAll(() => {
		envService = {
			getKey: vi.fn().mockReturnValue(VALID_MASTER_KEY),
		} as any;
		sut = new AesEncryptionServiceAdapter(envService);
	});

	describe('constructor', () => {
		it('should throw if ENCRYPTION_MASTER_KEY has invalid length', () => {
			const invalidKey = randomBytes(16).toString('hex');
			const invalidEnvService = {
				getKey: vi.fn().mockReturnValue(invalidKey),
			} as any;
			expect(() => new AesEncryptionServiceAdapter(invalidEnvService)).toThrow(
				BadRequestException,
			);
		});

		it('should initialize successfully with valid 32-byte master key', () => {
			const validEnvService = {
				getKey: vi.fn().mockReturnValue(VALID_MASTER_KEY),
			} as any;
			expect(
				() => new AesEncryptionServiceAdapter(validEnvService),
			).not.toThrow();
		});
	});

	describe('.encrypt', () => {
		it('should encrypt plain text and return formatted string', () => {
			const plainText = 'my-secret-api-key-12345';
			const encrypted = sut.encrypt(plainText);
			const parts = encrypted.split(':');
			expect(parts).toHaveLength(3);
			const [iv, ciphertext, authTag] = parts;
			expect(iv).toHaveLength(32);
			expect(iv).toMatch(/^[0-9a-f]{32}$/);
			expect(ciphertext!.length).toBeGreaterThan(0);
			expect(authTag).toHaveLength(32);
		});

		it('should generate different encrypted outputs for same input', () => {
			const plainText = 'same-text-twice';
			const encrypted1 = sut.encrypt(plainText);
			const encrypted2 = sut.encrypt(plainText);
			expect(encrypted1).not.toBe(encrypted2);
		});

		it('should encrypt long text successfully', () => {
			const longText = 'a'.repeat(10000);
			const encrypted = sut.encrypt(longText);
			expect(encrypted.split(':')).toHaveLength(3);
		});
	});

	describe('.decrypt', () => {
		it('should decrypt previously encrypted text back to original', () => {
			const originalText = 'my-secret-password-123';
			const encrypted = sut.encrypt(originalText);
			const decrypted = sut.decrypt(encrypted);
			expect(decrypted).toBe(originalText);
		});

		it('should decrypt long text', () => {
			const longText = 'x'.repeat(5000);
			const encrypted = sut.encrypt(longText);
			const decrypted = sut.decrypt(encrypted);
			expect(decrypted).toBe(longText);
		});

		it('should throw if authTag is tampered', () => {
			const encrypted = sut.encrypt('original-text');
			const [iv, ciphertext, authTag] = encrypted.split(':');
			const tamperedAuthTag = authTag!.replace(/0/g, '1');
			const tamperedEncrypted = `${iv}:${ciphertext}:${tamperedAuthTag}`;
			expect(() => sut.decrypt(tamperedEncrypted as any)).toThrow(
				InternalServerErrorException,
			);
		});

		it('should throw if ciphertext is tampered', () => {
			const encrypted = sut.encrypt('original-text');
			const [iv, ciphertext, authTag] = encrypted.split(':');
			const tamperedCiphertext =
				ciphertext!.substring(0, ciphertext!.length - 4) + 'ffff';
			const tamperedEncrypted = `${iv}:${tamperedCiphertext}:${authTag}`;
			expect(() => sut.decrypt(tamperedEncrypted as any)).toThrow(
				InternalServerErrorException,
			);
		});

		it('should throw with wrong master key', () => {
			const encrypted = sut.encrypt('test-data');
			const differentKey = randomBytes(32).toString('hex');
			const differentEnvService = {
				getKey: vi.fn().mockReturnValue(differentKey),
			} as any;
			const differentSut = new AesEncryptionServiceAdapter(differentEnvService);
			expect(() => differentSut.decrypt(encrypted)).toThrow(
				InternalServerErrorException,
			);
		});
	});

	describe('round-trip', () => {
		it('should maintain data integrity through multiple cycles', () => {
			const originalText = 'test-api-key-round-trip';
			const encrypted1 = sut.encrypt(originalText);
			const decrypted1 = sut.decrypt(encrypted1);
			expect(decrypted1).toBe(originalText);
			const encrypted2 = sut.encrypt(decrypted1);
			const decrypted2 = sut.decrypt(encrypted2);
			expect(decrypted2).toBe(originalText);
		});

		it('should handle various credential formats correctly', () => {
			const credentials = [
				'sk_test_abc123',
				'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
				'api_key_1234567890abcdef',
			];
			credentials.forEach((credential) => {
				const encrypted = sut.encrypt(credential);
				const decrypted = sut.decrypt(encrypted);
				expect(decrypted).toBe(credential);
			});
		});
	});

	describe('security properties', () => {
		it('should provide confidentiality', () => {
			const sensitiveData = 'super-secret-password-123';
			const encrypted = sut.encrypt(sensitiveData);
			expect(encrypted).not.toContain(sensitiveData);
			expect(encrypted).not.toContain('super');
			expect(encrypted).not.toContain('secret');
		});

		it('should ensure uniqueness', () => {
			const plainText = 'test-uniqueness';
			const encrypted1 = sut.encrypt(plainText);
			const encrypted2 = sut.encrypt(plainText);
			const encrypted3 = sut.encrypt(plainText);
			expect(encrypted1).not.toBe(encrypted2);
			expect(encrypted2).not.toBe(encrypted3);
			expect(sut.decrypt(encrypted1)).toBe(plainText);
			expect(sut.decrypt(encrypted2)).toBe(plainText);
			expect(sut.decrypt(encrypted3)).toBe(plainText);
		});

		it('should use proper IV length', () => {
			const encrypted = sut.encrypt('test');
			const [iv] = encrypted.split(':');
			expect(iv).toHaveLength(32);
		});

		it('should use proper authTag length', () => {
			const encrypted = sut.encrypt('test');
			const [, , authTag] = encrypted.split(':');
			expect(authTag).toHaveLength(32);
		});
	});

	describe('performance', () => {
		it('should handle encryption of multiple credentials efficiently', () => {
			const credentials = Array.from(
				{ length: 100 },
				(_, i) => `credential-${i}`,
			);
			const startTime = Date.now();
			credentials.forEach((cred) => {
				const encrypted = sut.encrypt(cred);
				const decrypted = sut.decrypt(encrypted);
				expect(decrypted).toBe(cred);
			});
			const endTime = Date.now();
			expect(endTime - startTime).toBeLessThan(1000);
		});

		it('should handle large payloads', () => {
			const largePayload = 'x'.repeat(50000);
			const encrypted = sut.encrypt(largePayload);
			const decrypted = sut.decrypt(encrypted);
			expect(decrypted).toBe(largePayload);
		});
	});
});
