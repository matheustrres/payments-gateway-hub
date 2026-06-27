import { createHmac } from 'node:crypto';

import {
	BadRequestException,
	ExecutionContext,
	RawBodyRequest,
	UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';
import { WebhookSignatureGuard } from '@/modules/webhooks/infra/auth/guards/webhook-signature.guard';
import { IWebhookSignatureStrategy } from '@/modules/webhooks/infra/strategies/webhook-signature.strategy';

import { ProviderCredentialEntityBuilder } from '#/data/builders/entities/provider-credential.entity.builder';
import { createProvidersCredentialsRepositoryMock } from '#/data/mocks/repositories/providers-credentials.repository';

describe(WebhookSignatureGuard.name, () => {
	let sut: WebhookSignatureGuard;
	let credentialsRepository: Mocked<IProvidersCredentialsRepository>;
	let mockStrategy: Mocked<IWebhookSignatureStrategy>;
	let mockExecutionContext: Mocked<ExecutionContext>;

	const webhookSecret = 'test-webhook-secret';
	const projectId = 'project-123';
	const provider = EPaymentProvider.AbacatePay;
	const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf-8');

	const createMockRequest = (
		overrides?: Partial<RawBodyRequest<Request>>,
	): RawBodyRequest<Request> => {
		const signature = createHmac('sha256', webhookSecret)
			.update(rawBody.toString('utf-8'), 'utf-8')
			.digest('base64');
		return {
			headers: {
				'x-webhook-signature': signature,
				'x-webhook-secret': webhookSecret,
			},
			rawBody,
			params: {
				projectId,
				provider,
			},
			...overrides,
		} as RawBodyRequest<Request>;
	};

	const createMockExecutionContext = (
		request: RawBodyRequest<Request>,
	): Mocked<ExecutionContext> => {
		return {
			switchToHttp: vi.fn().mockReturnValue({
				getRequest: vi.fn().mockReturnValue(request),
			}),
		} as unknown as Mocked<ExecutionContext>;
	};

	beforeEach(() => {
		credentialsRepository = createProvidersCredentialsRepositoryMock();
		mockStrategy = {
			supports: vi.fn((prov: EPaymentProvider) => prov === provider),
			verifySignature: vi.fn(async () => true),
		} as unknown as Mocked<IWebhookSignatureStrategy>;
		sut = new WebhookSignatureGuard(credentialsRepository, [mockStrategy]);
	});

	describe('Request data extraction', () => {
		it('should throw BadRequestException if projectId is missing', async () => {
			const request = createMockRequest({
				params: {
					provider,
				} as any,
			});
			mockExecutionContext = createMockExecutionContext(request);
			await expect(sut.canActivate(mockExecutionContext)).rejects.toThrow(
				new BadRequestException('Missing projectId or provider in URL'),
			);
		});

		it('should throw BadRequestException if provider is missing', async () => {
			const request = createMockRequest({
				params: {
					projectId,
				} as any,
			});
			mockExecutionContext = createMockExecutionContext(request);
			await expect(sut.canActivate(mockExecutionContext)).rejects.toThrow(
				new BadRequestException('Missing projectId or provider in URL'),
			);
		});

		it('should extract request data successfully when all required fields are present', async () => {
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				credential,
			);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await sut.canActivate(mockExecutionContext);
			expect(mockExecutionContext.switchToHttp).toHaveBeenCalled();
		});
	});

	describe('Strategy selection', () => {
		it('should throw BadRequestException when no strategy supports the provider', async () => {
			mockStrategy.supports.mockReturnValue(false);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await expect(sut.canActivate(mockExecutionContext)).rejects.toThrow(
				new BadRequestException(
					`No signature strategy found for provider: ${provider}`,
				),
			);
		});

		it('should select the correct strategy for the provider', async () => {
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				credential,
			);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await sut.canActivate(mockExecutionContext);
			expect(mockStrategy.supports).toHaveBeenCalledWith(provider);
		});
	});

	describe('Credentials fetching', () => {
		it('should fetch both production and sandbox credentials', async () => {
			const productionCred = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.withIsProduction(true)
				.build();
			const sandboxCred = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.withIsProduction(false)
				.build();
			credentialsRepository.findByProjectIdAndProvider
				.mockResolvedValueOnce(productionCred)
				.mockResolvedValueOnce(sandboxCred);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await sut.canActivate(mockExecutionContext);
			expect(
				credentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledTimes(2);
			expect(
				credentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenNthCalledWith(1, projectId, provider, true);
			expect(
				credentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenNthCalledWith(2, projectId, provider, false);
		});

		it('should throw UnauthorizedException when no credentials are found', async () => {
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(null);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await expect(sut.canActivate(mockExecutionContext)).rejects.toThrow(
				new UnauthorizedException(
					'No credentials configured for this project/provider',
				),
			);
		});

		it('should filter out null credentials', async () => {
			const validCredential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider
				.mockResolvedValueOnce(validCredential)
				.mockResolvedValueOnce(null);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			const result = await sut.canActivate(mockExecutionContext);
			expect(result).toBe(true);
		});
	});

	describe('Signature verification delegation', () => {
		it('should delegate signature verification to strategy', async () => {
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider
				.mockResolvedValueOnce(credential)
				.mockResolvedValueOnce(null);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await sut.canActivate(mockExecutionContext);
			expect(mockStrategy.verifySignature).toHaveBeenCalledWith(
				[credential],
				request,
			);
		});

		it('should return true when strategy verifies signature successfully', async () => {
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				credential,
			);
			mockStrategy.verifySignature.mockResolvedValue(true);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			const result = await sut.canActivate(mockExecutionContext);
			expect(result).toBe(true);
		});

		it('should throw UnauthorizedException when strategy verification fails', async () => {
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				credential,
			);
			mockStrategy.verifySignature.mockResolvedValue(false);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await expect(sut.canActivate(mockExecutionContext)).rejects.toThrow(
				new UnauthorizedException('Invalid Webhook Signature'),
			);
		});
	});

	describe('Integration scenarios', () => {
		it('should handle complete valid webhook request flow', async () => {
			const productionCred = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.withIsProduction(true)
				.build();
			credentialsRepository.findByProjectIdAndProvider
				.mockResolvedValueOnce(productionCred)
				.mockResolvedValueOnce(null);
			mockStrategy.verifySignature.mockResolvedValue(true);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			const result = await sut.canActivate(mockExecutionContext);
			expect(result).toBe(true);
			expect(
				credentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledTimes(2);
			expect(mockStrategy.verifySignature).toHaveBeenCalled();
		});

		it('should handle multiple strategies and select the correct one', async () => {
			const asaasStrategy = {
				supports: vi.fn(
					(prov: EPaymentProvider) => prov === EPaymentProvider.Asaas,
				),
				verifySignature: vi.fn(async () => false),
			} as unknown as IWebhookSignatureStrategy;
			sut = new WebhookSignatureGuard(credentialsRepository, [
				asaasStrategy,
				mockStrategy,
			]);
			const credential = new ProviderCredentialEntityBuilder()
				.withProvider(provider)
				.build();
			credentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
				credential,
			);
			const request = createMockRequest();
			mockExecutionContext = createMockExecutionContext(request);
			await sut.canActivate(mockExecutionContext);
			expect(mockStrategy.supports).toHaveBeenCalledWith(provider);
			expect(mockStrategy.verifySignature).toHaveBeenCalled();
			expect(asaasStrategy.verifySignature).not.toHaveBeenCalled();
		});
	});
});
