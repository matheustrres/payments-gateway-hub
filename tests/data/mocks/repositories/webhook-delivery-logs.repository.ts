import { Mocked } from 'vitest';

import { IWebhookDeliveryLogsRepository } from '@/modules/webhooks/domain/repositories/webhook-delivery-logs.repository';

export function createWebhookDeliveryLogsRepositoryMock(): Mocked<IWebhookDeliveryLogsRepository> {
	return {
		insertOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		updateOne: vi.fn(),
		deleteOne: vi.fn(),
		findManyByTransactionId: vi.fn(),
		findManyByProjectId: vi.fn(),
		deleteMany: vi.fn(),
	};
}
