import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';
import { AsaasSignatureStrategy } from '@/modules/webhooks/infra/strategies/signatures/asaas-signature.strategy';

describe(AsaasSignatureStrategy.name, () => {
	let sut: AsaasSignatureStrategy;
	let encryptionService: IEncryptionServicePort;

	beforeEach(() => {
		encryptionService = {
			encrypt: vi.fn(),
			decrypt: vi.fn(),
		};
		sut = new AsaasSignatureStrategy(encryptionService);
	});

	describe('.supports', () => {
		it('should return true for Asaas provider', () => {
			const result = sut.supports(EPaymentProvider.Asaas);
			expect(result).toBe(true);
		});

		it('should return false for AbacatePay provider', () => {
			const result = sut.supports(EPaymentProvider.AbacatePay);
			expect(result).toBe(false);
		});

		it('should return false for Payoneer provider', () => {
			const result = sut.supports(EPaymentProvider.Payoneer);
			expect(result).toBe(false);
		});
	});

	describe('.verifySignature', () => {
		const validWebhookSecret = 'valid-webhook-secret-123';
		const encryptedCredentials = 'encrypted-data';

		function createMockRequest(
			token?: string,
			rawBody?: Buffer,
		): RawBodyRequest<Request> {
			return {
				headers: {
					'asaas-access-token': token,
				},
				rawBody,
			} as unknown as RawBodyRequest<Request>;
		}

		function createMockCredential(
			_webhookSecret: string,
		): ProviderCredentialEntity {
			return {
				encryptedCredentials,
			} as unknown as ProviderCredentialEntity;
		}

		describe('successful validation', () => {
			it('should return true when token matches a valid credential', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: validWebhookSecret }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
				expect(encryptionService.decrypt).toHaveBeenCalledWith(
					encryptedCredentials,
				);
			});

			it('should find matching credential in multiple credentials (test + live)', async () => {
				const testSecret = 'test-webhook-secret';
				const liveSecret = 'live-webhook-secret';

				const credentials = [
					createMockCredential(testSecret),
					createMockCredential(liveSecret),
				];

				const request = createMockRequest(liveSecret, Buffer.from('payload'));

				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: testSecret }))
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: liveSecret }));

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
				expect(encryptionService.decrypt).toHaveBeenCalledTimes(2);
			});

			it('should match first valid credential when multiple match', async () => {
				const sharedSecret = 'shared-secret';

				const credentials = [
					createMockCredential(sharedSecret),
					createMockCredential(sharedSecret),
				];

				const request = createMockRequest(sharedSecret, Buffer.from('payload'));

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: sharedSecret }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
			});
		});

		describe('failed validation - missing headers/body', () => {
			it('should return false when asaas-access-token header is missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(undefined, Buffer.from('payload'));

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
				expect(encryptionService.decrypt).not.toHaveBeenCalled();
			});

			it('should return false when asaas-access-token header is empty string', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest('', Buffer.from('payload'));

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});

			it('should return false when rawBody is missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(validWebhookSecret, undefined);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});
		});

		describe('failed validation - no matching credentials', () => {
			it('should return false when token does not match any credential', async () => {
				const credentials = [createMockCredential('different-secret')];
				const request = createMockRequest(
					'wrong-token',
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: 'different-secret' }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});

			it('should return false when credentials array is empty', async () => {
				const credentials: ProviderCredentialEntity[] = [];
				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});

			it('should handle multiple non-matching credentials', async () => {
				const credentials = [
					createMockCredential('secret-1'),
					createMockCredential('secret-2'),
					createMockCredential('secret-3'),
				];

				const request = createMockRequest(
					'wrong-token',
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: 'secret-1' }))
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: 'secret-2' }))
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: 'secret-3' }));

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
				expect(encryptionService.decrypt).toHaveBeenCalledTimes(3);
			});
		});

		describe('failed validation - decryption errors', () => {
			it('should skip credential when decryption throws error', async () => {
				const credentials = [
					createMockCredential('bad-cred'),
					createMockCredential(validWebhookSecret),
				];

				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt')
					.mockImplementationOnce(() => {
						throw new Error('Decryption failed');
					})
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
				expect(encryptionService.decrypt).toHaveBeenCalledTimes(2);
			});

			it('should skip credential when JSON.parse fails', async () => {
				const credentials = [
					createMockCredential('bad-json'),
					createMockCredential(validWebhookSecret),
				];

				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce('invalid-json-{')
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
			});

			it('should return false when all credentials fail to decrypt', async () => {
				const credentials = [
					createMockCredential('bad-1'),
					createMockCredential('bad-2'),
				];

				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt').mockImplementation(() => {
					throw new Error('Decryption failed');
				});

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});
		});

		describe('edge cases', () => {
			it('should handle credential with missing webhookSecret field', async () => {
				const credentials = [
					createMockCredential('no-webhook-secret'),
					createMockCredential(validWebhookSecret),
				];

				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(JSON.stringify({ apiKey: 'some-key' }))
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
			});

			it('should handle credential with null webhookSecret', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];

				const request = createMockRequest(
					validWebhookSecret,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: null }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});

			it('should handle whitespace in token', async () => {
				const tokenWithSpaces = '  secret-with-spaces  ';
				const credentials = [createMockCredential(tokenWithSpaces)];

				const request = createMockRequest(
					tokenWithSpaces,
					Buffer.from('payload'),
				);

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: tokenWithSpaces }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(true);
			});

			it('should handle case-sensitive token comparison', async () => {
				const credentials = [createMockCredential('Secret123')];
				const request = createMockRequest('secret123', Buffer.from('payload'));

				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: 'Secret123' }),
				);

				const result = await sut.verifySignature(credentials, request);

				expect(result).toBe(false);
			});
		});
	});
});
