import { BadRequestException } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { AsaasWebhookProvisioningAdapter } from '@/modules/backoffice/infra/adapters/webhook-provisioning/asaas-webhook-provisioning.adapter';

import { EnvService } from '@/shared/modules/env/env.service';
import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

describe('[Unit] AsaasWebhookProvisioningAdapter', () => {
	let adapter: AsaasWebhookProvisioningAdapter;
	let httpService: IHttpRequestingService;
	let envService: EnvService;

	const mockProjectId = 'proj_123';
	const mockApiKey = 'asaas_api_key_test';
	const mockBaseUrl = 'https://api-hub.example.com';

	beforeEach(() => {
		httpService = {
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
		} as unknown as IHttpRequestingService;

		envService = {
			getKey: vi.fn((key: string) => {
				if (key === 'BASE_URL') return mockBaseUrl;
				if (key === 'ADMIN_EMAIL') return 'admin@example.com';
				return '';
			}),
		} as unknown as EnvService;

		adapter = new AsaasWebhookProvisioningAdapter(httpService, envService);
	});

	describe('supports', () => {
		it('should return true for Asaas provider', () => {
			expect(adapter.supports(EPaymentProvider.Asaas)).toBe(true);
		});

		it('should return false for non-Asaas providers', () => {
			expect(adapter.supports(EPaymentProvider.AbacatePay)).toBe(false);
			expect(adapter.supports(EPaymentProvider.Payoneer)).toBe(false);
		});
	});

	describe('provision', () => {
		it('should successfully provision a webhook in sandbox mode', async () => {
			const mockResponse: AxiosResponse = {
				data: {
					id: 'webhook_123',
					name: `Payment Hub - Project ${mockProjectId}`,
					url: `${mockBaseUrl}/webhooks/inbound/${mockProjectId}/asaas`,
					email: 'admin@example.com',
					enabled: true,
					interrupted: false,
					authToken: null,
					sendType: 'SEQUENTIALLY',
					apiVersion: 3,
					type: 'WEBHOOK',
				},
				status: 200,
				statusText: 'OK',
				headers: {},
				config: {} as any,
			};

			(httpService.post as Mock).mockReturnValue(of(mockResponse));

			const result = await adapter.provision({
				apiKey: mockApiKey,
				projectId: mockProjectId,
				isSandbox: true,
			});

			expect(result).toEqual({
				webhookId: 'webhook_123',
				webhookUrl: `${mockBaseUrl}/webhooks/inbound/${mockProjectId}/asaas`,
			});

			expect(httpService.post).toHaveBeenCalledWith(
				'https://api-sandbox.asaas.com/v3/webhooks',
				expect.objectContaining({
					name: `Payment Hub - Project ${mockProjectId}`,
					url: `${mockBaseUrl}/webhooks/inbound/${mockProjectId}/asaas`,
					email: 'admin@example.com',
					enabled: true,
					interrupted: false,
					authToken: null,
					sendType: 'SEQUENTIALLY',
					events: expect.any(Array),
				}),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						access_token: mockApiKey,
					}),
				}),
			);

			// Verify at least some important events are included
			const callPayload = (httpService.post as any).mock.calls[0][1];
			expect(callPayload.events).toContain('PAYMENT_CONFIRMED');
			expect(callPayload.events).toContain('PAYMENT_RECEIVED');
		});

		it('should successfully provision a webhook in production mode', async () => {
			const mockResponse: AxiosResponse = {
				data: {
					id: 'webhook_prod_123',
					name: `Payment Hub - Project ${mockProjectId}`,
					url: `${mockBaseUrl}/webhooks/inbound/${mockProjectId}/asaas`,
					email: 'admin@example.com',
					enabled: true,
					interrupted: false,
					authToken: null,
					sendType: 'SEQUENTIALLY',
					apiVersion: 3,
					type: 'WEBHOOK',
				},
				status: 200,
				statusText: 'OK',
				headers: {},
				config: {} as any,
			};

			(httpService.post as Mock).mockReturnValue(of(mockResponse));

			const result = await adapter.provision({
				apiKey: mockApiKey,
				projectId: mockProjectId,
				isSandbox: false,
			});

			expect(result).toEqual({
				webhookId: 'webhook_prod_123',
				webhookUrl: `${mockBaseUrl}/webhooks/inbound/${mockProjectId}/asaas`,
			});

			expect(httpService.post).toHaveBeenCalledWith(
				'https://api.asaas.com/v3/webhooks',
				expect.any(Object),
				expect.any(Object),
			);
		});

		it('should throw BadRequestException when Asaas returns errors', async () => {
			const mockErrorResponse: AxiosResponse = {
				data: {
					errors: [
						{
							code: 'invalid_url',
							description: 'The webhook URL is invalid',
						},
						{
							code: 'duplicate_webhook',
							description: 'Webhook already exists for this URL',
						},
					],
				},
				status: 400,
				statusText: 'Bad Request',
				headers: {},
				config: {} as any,
			};

			(httpService.post as Mock).mockReturnValue(of(mockErrorResponse));

			await expect(
				adapter.provision({
					apiKey: mockApiKey,
					projectId: mockProjectId,
					isSandbox: true,
				}),
			).rejects.toThrow(BadRequestException);

			await expect(
				adapter.provision({
					apiKey: mockApiKey,
					projectId: mockProjectId,
					isSandbox: true,
				}),
			).rejects.toThrow(
				'Asaas Webhook Creation Error: invalid_url: The webhook URL is invalid; duplicate_webhook: Webhook already exists for this URL',
			);
		});

		it('should handle Axios errors properly', async () => {
			const axiosError: AxiosError = {
				isAxiosError: true,
				message: 'Network Error',
				name: 'AxiosError',
				config: {} as any,
				toJSON: () => ({}),
				response: {
					status: 500,
					statusText: 'Internal Server Error',
					data: {
						error: 'Internal server error occurred',
					},
					headers: {},
					config: {} as any,
				},
			};

			(httpService.post as Mock).mockReturnValue(throwError(() => axiosError));

			await expect(
				adapter.provision({
					apiKey: mockApiKey,
					projectId: mockProjectId,
					isSandbox: true,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should handle Axios errors with error array', async () => {
			const axiosError: AxiosError = {
				isAxiosError: true,
				message: 'Bad Request',
				name: 'AxiosError',
				config: {} as any,
				toJSON: () => ({}),
				response: {
					status: 400,
					statusText: 'Bad Request',
					data: {
						errors: [
							{
								code: 'invalid_credentials',
								description: 'API key is invalid',
							},
						],
					},
					headers: {},
					config: {} as any,
				},
			};

			(httpService.post as Mock).mockReturnValue(throwError(() => axiosError));

			await expect(
				adapter.provision({
					apiKey: mockApiKey,
					projectId: mockProjectId,
					isSandbox: true,
				}),
			).rejects.toThrow('invalid_credentials: API key is invalid');
		});

		it('should handle unexpected errors', async () => {
			const unexpectedError = new Error('Unexpected error');

			(httpService.post as Mock).mockReturnValue(
				throwError(() => unexpectedError),
			);

			await expect(
				adapter.provision({
					apiKey: mockApiKey,
					projectId: mockProjectId,
					isSandbox: true,
				}),
			).rejects.toThrow('Erro inesperado ao provisionar webhook no Asaas.');
		});
	});
});
