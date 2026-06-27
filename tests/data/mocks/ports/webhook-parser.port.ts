import { Mocked } from 'vitest';

import { IWebhookParserPort } from '@/modules/webhooks/application/ports/webhook-parser.port';

export function createWebhookParserPortMock(): Mocked<IWebhookParserPort> {
	return {
		parse: vi.fn(),
		supports: vi.fn(),
	};
}
