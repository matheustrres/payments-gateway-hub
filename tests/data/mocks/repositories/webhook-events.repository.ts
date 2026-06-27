import { Mocked } from 'vitest';

import { IWebhookEventsRepository } from '@/modules/webhooks/domain/repositories/webhook-events.repository';

export function createWebhookEventsRepositoryMock(): Mocked<IWebhookEventsRepository> {
	return {
		insertOne: vi.fn(),
		updateOne: vi.fn(),
		findById: vi.fn(),
		findAll: vi.fn(),
		deleteOne: vi.fn(),
		findManyToRetry: vi.fn(),
		findByExternalEventId: vi.fn(),
		findByTransactionId: vi.fn(),
	};
}
