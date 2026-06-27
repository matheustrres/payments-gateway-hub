import { createHmac } from 'node:crypto';

import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';
import { AbacatePaySignatureStrategy } from '@/modules/webhooks/infra/strategies/signatures/abacate-pay-signature.strategy';

import { createEncryptionServiceMock } from '#/data/mocks/services/encryption-service';

describe(AbacatePaySignatureStrategy.name, () => {
	let sut: AbacatePaySignatureStrategy;
	let encryptionService: IEncryptionServicePort;

	beforeEach(() => {
		encryptionService = createEncryptionServiceMock();
		sut = new AbacatePaySignatureStrategy(encryptionService);
	});

	describe('.supports', () => {
		it('should return true for AbacatePay provider', () => {
			const result = sut.supports(EPaymentProvider.AbacatePay);
			expect(result).toBe(true);
		});

		it('should return false for Asaas provider', () => {
			const result = sut.supports(EPaymentProvider.Asaas);
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
			signature?: string,
			secret?: string,
			rawBody?: Buffer,
		): RawBodyRequest<Request> {
			return {
				headers: {
					'x-webhook-signature': signature,
					'x-webhook-secret': secret,
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

		function computeValidSignature(secret: string, data: Buffer): string {
			return createHmac('sha256', secret.trim()).update(data).digest('base64');
		}

		describe('successful validation', () => {
			it('should return true when signature and secret match', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
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
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(liveSecret, payload);
				const credentials = [
					createMockCredential(testSecret),
					createMockCredential(liveSecret),
				];
				const request = createMockRequest(validSignature, liveSecret, payload);
				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: testSecret }))
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: liveSecret }))
					.mockReturnValueOnce(JSON.stringify({ webhookSecret: liveSecret }));
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
				expect(encryptionService.decrypt).toHaveBeenCalledTimes(3);
			});

			it('should match first valid credential when multiple match', async () => {
				const sharedSecret = 'shared-secret';
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(sharedSecret, payload);
				const credentials = [
					createMockCredential(sharedSecret),
					createMockCredential(sharedSecret),
				];
				const request = createMockRequest(
					validSignature,
					sharedSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: sharedSecret }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});

			it('should handle secret with whitespace correctly', async () => {
				const secretWithSpaces = '  secret-with-spaces  ';
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(secretWithSpaces, payload);
				const credentials = [createMockCredential(secretWithSpaces)];
				const request = createMockRequest(
					validSignature,
					secretWithSpaces,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: secretWithSpaces }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});
		});

		describe('fallback behavior (HMAC mismatch but secret match)', () => {
			it('should return true when HMAC fails but secret matches (fallback)', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const wrongSignature = 'wrong-signature-base64';
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					wrongSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: validWebhookSecret }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});
		});

		describe('failed validation - missing headers/body', () => {
			it('should return false when x-webhook-signature header is missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					undefined,
					validWebhookSecret,
					Buffer.from('payload'),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
				expect(encryptionService.decrypt).not.toHaveBeenCalled();
			});

			it('should return false when x-webhook-secret header is missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					'some-signature',
					undefined,
					Buffer.from('payload'),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
				expect(encryptionService.decrypt).not.toHaveBeenCalled();
			});

			it('should return false when rawBody is missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					'some-signature',
					validWebhookSecret,
					undefined,
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should return false when all required fields are missing', async () => {
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(undefined, undefined, undefined);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});
		});

		describe('failed validation - no matching credentials', () => {
			it('should return false when secret does not match any credential', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature('wrong-secret', payload);
				const credentials = [createMockCredential('different-secret')];
				const request = createMockRequest(
					validSignature,
					'wrong-secret',
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: 'different-secret' }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should return false when credentials array is empty', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials: ProviderCredentialEntity[] = [];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should handle multiple non-matching credentials', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature('wrong-secret', payload);
				const credentials = [
					createMockCredential('secret-1'),
					createMockCredential('secret-2'),
					createMockCredential('secret-3'),
				];
				const request = createMockRequest(
					validSignature,
					'wrong-secret',
					payload,
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
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [
					createMockCredential('bad-cred'),
					createMockCredential(validWebhookSecret),
				];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt')
					.mockImplementationOnce(() => {
						throw new Error('Decryption failed');
					})
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					)
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
				expect(encryptionService.decrypt).toHaveBeenCalledTimes(3);
			});

			it('should skip credential when JSON.parse fails', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [
					createMockCredential('bad-json'),
					createMockCredential(validWebhookSecret),
				];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce('invalid-json-{')
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					)
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});

			it('should return false when all credentials fail to decrypt', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [
					createMockCredential('bad-1'),
					createMockCredential('bad-2'),
				];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockImplementation(() => {
					throw new Error('Decryption failed');
				});
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should return false when decryption succeeds but verification throws error', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					)
					.mockImplementationOnce(() => {
						throw new Error('Second decrypt failed');
					});
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});
		});

		describe('edge cases', () => {
			it('should handle credential with missing webhookSecret field', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [
					createMockCredential('no-webhook-secret'),
					createMockCredential(validWebhookSecret),
				];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt')
					.mockReturnValueOnce(JSON.stringify({ apiKey: 'some-key' }))
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					)
					.mockReturnValueOnce(
						JSON.stringify({ webhookSecret: validWebhookSecret }),
					);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});

			it('should handle credential with null webhookSecret', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					payload,
				);
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: null }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should handle case-sensitive secret comparison', async () => {
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature('Secret123', payload);
				const credentials = [createMockCredential('Secret123')];
				const request = createMockRequest(validSignature, 'secret123', payload);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: 'Secret123' }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(false);
			});

			it('should handle different payload sizes', async () => {
				const largePayload = Buffer.from(
					JSON.stringify({ data: 'x'.repeat(10000) }),
				);
				const validSignature = computeValidSignature(
					validWebhookSecret,
					largePayload,
				);
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					largePayload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: validWebhookSecret }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});

			it('should handle empty payload', async () => {
				const emptyPayload = Buffer.from('');
				const validSignature = computeValidSignature(
					validWebhookSecret,
					emptyPayload,
				);
				const credentials = [createMockCredential(validWebhookSecret)];
				const request = createMockRequest(
					validSignature,
					validWebhookSecret,
					emptyPayload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: validWebhookSecret }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});

			it('should handle special characters in secret', async () => {
				const specialSecret = 'secret!@#$%^&*()_+-=[]{}|;:,.<>?';
				const payload = Buffer.from('{"event":"payment.paid"}');
				const validSignature = computeValidSignature(specialSecret, payload);
				const credentials = [createMockCredential(specialSecret)];
				const request = createMockRequest(
					validSignature,
					specialSecret,
					payload,
				);
				vi.spyOn(encryptionService, 'decrypt').mockReturnValue(
					JSON.stringify({ webhookSecret: specialSecret }),
				);
				const result = await sut.verifySignature(credentials, request);
				expect(result).toBe(true);
			});
		});
	});
});
