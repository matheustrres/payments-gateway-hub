import { Mocked } from 'vitest';

import { IWebhookQueueProducerPort } from '@/modules/webhooks/application/ports/queue-producer.port';

export function createMockWebhookQueueProducerPort(): Mocked<IWebhookQueueProducerPort> {
	return {
		dispatch: vi.fn(),
	};
}
