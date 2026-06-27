import { WebhookEvent } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { EPaymentProvider } from '@/core/enums/payment';

import { WebhookEventEntity } from '@/modules/webhooks/domain/entities/webhook-event.entity';
import { EWebhookEventStatus } from '@/modules/webhooks/domain/enums/webhook-event-status';
import { WebhookEventMapper } from '@/modules/webhooks/infra/database/mappers/webhook-event.mapper';

import { WebhookEventEntityBuilder } from '#/data/builders/entities/webhook-event.entity.builder';

describe(WebhookEventMapper.name, () => {
	describe('.toDomain', () => {
		it('should map Prisma model to domain entity', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid', data: { id: '123' } },
				headers: { 'x-signature': 'abc123' },
				transactionId: 'transaction-789',
				status: EWebhookEventStatus.Processed,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: new Date('2024-01-01T00:05:00Z'),
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity).toBeInstanceOf(WebhookEventEntity);
			expect(entity.id.toString()).toBe('webhook-123');
			expect(entity.projectId.toString()).toBe('project-456');
			expect(entity.provider).toBe(EPaymentProvider.AbacatePay);
			expect(entity.status).toBe(EWebhookEventStatus.Processed);
			expect(entity.transactionId).toBe('transaction-789');
		});

		it('should handle null headers', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: null,
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.headers).toBeNull();
		});

		it('should handle null transactionId', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.transactionId).toBeNull();
		});

		it('should handle null errorMessage', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.errorMessage).toBeNull();
		});

		it('should handle null processedAt', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.processedAt).toBeNull();
		});

		it('should cast provider enum correctly', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: 'asaas' as any,
				payload: { event: 'payment.received' },
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.provider).toBe('asaas');
		});

		it('should cast status enum correctly', () => {
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: {},
				transactionId: null,
				status: 'Failed' as any,
				errorMessage: 'Some error',
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.status).toBe('Failed');
		});

		it('should preserve complex payload structure', () => {
			const complexPayload = {
				event: 'billing.paid',
				data: {
					billing: {
						id: 'billing-123',
						amount: 10000,
						items: [{ name: 'Item 1' }, { name: 'Item 2' }],
					},
					payment: {
						method: 'PIX',
						fee: 300,
					},
				},
			};
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: complexPayload,
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.payload).toEqual(complexPayload);
		});

		it('should preserve complex headers structure', () => {
			const complexHeaders = {
				'x-signature': 'abc123',
				'content-type': 'application/json',
				'user-agent': 'AbacatePay-Webhook/1.0',
				'x-request-id': 'req-456',
			};
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: complexHeaders,
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.headers).toEqual(complexHeaders);
		});

		it('should use receivedAt as createdAt in domain entity', () => {
			const receivedAt = new Date('2024-01-01T00:00:00Z');
			const prismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: {},
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: receivedAt,
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:01Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(prismaModel);
			expect(entity.createdAt).toEqual(receivedAt);
		});
	});

	describe('.toPersistence', () => {
		it('should map entity to Prisma model', () => {
			const entity = new WebhookEventEntityBuilder()
				.withProjectId('project-456')
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.id).toBe(entity.id.toString());
			expect(prismaModel.projectId).toBe('project-456');
			expect(prismaModel.provider).toBe(entity.provider);
			expect(prismaModel.status).toBe(entity.status);
		});

		it('should stringify payload', () => {
			const entity = new WebhookEventEntityBuilder()
				.withPayload({ event: 'billing.paid', data: { id: '123' } })
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(typeof prismaModel.payload).toBe('string');
			expect(prismaModel.payload).toBe(
				JSON.stringify({ event: 'billing.paid', data: { id: '123' } }),
			);
		});

		it('should stringify headers when present', () => {
			const entity = new WebhookEventEntityBuilder()
				.withHeaders({ 'x-signature': 'abc123' })
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(typeof prismaModel.headers).toBe('string');
			expect(prismaModel.headers).toBe(
				JSON.stringify({ 'x-signature': 'abc123' }),
			);
		});

		it('should handle null headers', () => {
			const entity = new WebhookEventEntityBuilder().withHeaders(null).build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.headers).toBeNull();
		});

		it('should preserve all required fields', () => {
			const entity = new WebhookEventEntityBuilder()
				.withProjectId('project-456')
				.withTransactionId('transaction-789')
				.withErrorMessage('Some error')
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.projectId).toBe('project-456');
			expect(prismaModel.transactionId).toBe('transaction-789');
			expect(prismaModel.errorMessage).toBe('Some error');
			expect(prismaModel.receivedAt).toBeInstanceOf(Date);
			expect(prismaModel.createdAt).toBeInstanceOf(Date);
		});

		it('should include processedAt when present', () => {
			const processedAt = new Date('2024-01-01T00:05:00Z');
			const entity = new WebhookEventEntityBuilder()
				.withProcessedAt(processedAt)
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.processedAt).toEqual(processedAt);
		});

		it('should handle null transactionId', () => {
			const entity = new WebhookEventEntityBuilder()
				.withTransactionId(null)
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.transactionId).toBeNull();
		});

		it('should handle null errorMessage', () => {
			const entity = new WebhookEventEntityBuilder()
				.withErrorMessage(null)
				.build();
			const prismaModel = WebhookEventMapper.toPersistence(entity);
			expect(prismaModel.errorMessage).toBeNull();
		});
	});

	describe('round-trip conversion', () => {
		it('should preserve data through full conversion cycle', () => {
			const originalPrismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid', data: { id: '123', amount: 10000 } },
				headers: {
					'x-signature': 'abc123',
					'content-type': 'application/json',
				},
				transactionId: 'transaction-789',
				status: EWebhookEventStatus.Processed,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: new Date('2024-01-01T00:05:00Z'),
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(originalPrismaModel);
			const backToPrisma = WebhookEventMapper.toPersistence(entity);
			expect(backToPrisma.id).toBe(originalPrismaModel.id);
			expect(backToPrisma.projectId).toBe(originalPrismaModel.projectId);
			expect(backToPrisma.provider).toBe(originalPrismaModel.provider);
			expect(backToPrisma.status).toBe(originalPrismaModel.status);
			expect(backToPrisma.transactionId).toBe(
				originalPrismaModel.transactionId,
			);
			expect(backToPrisma.receivedAt).toEqual(originalPrismaModel.receivedAt);
			expect(backToPrisma.processedAt).toEqual(originalPrismaModel.processedAt);
		});

		it('should preserve data with null optional fields', () => {
			const originalPrismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: { event: 'billing.paid' },
				headers: null,
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(originalPrismaModel);
			const backToPrisma = WebhookEventMapper.toPersistence(entity);
			expect(backToPrisma.headers).toBeNull();
			expect(backToPrisma.transactionId).toBeNull();
			expect(backToPrisma.errorMessage).toBeNull();
			expect(backToPrisma.processedAt).toBeNull();
		});

		it('should handle complex nested structures', () => {
			const complexPayload = {
				event: 'billing.paid',
				data: {
					billing: {
						id: 'billing-123',
						amount: 10000,
						metadata: {
							customerId: 'customer-456',
							tags: ['vip', 'recurring'],
						},
					},
				},
			};
			const originalPrismaModel: WebhookEvent = {
				id: 'webhook-123',
				projectId: 'project-456',
				provider: EPaymentProvider.AbacatePay,
				payload: complexPayload,
				headers: null,
				transactionId: null,
				status: EWebhookEventStatus.Pending,
				errorMessage: null,
				receivedAt: new Date('2024-01-01T00:00:00Z'),
				processedAt: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: null,
			};
			const entity = WebhookEventMapper.toDomain(originalPrismaModel);
			const backToPrisma = WebhookEventMapper.toPersistence(entity);
			expect(JSON.parse(backToPrisma.payload as string)).toEqual(
				complexPayload,
			);
		});
	});
});
