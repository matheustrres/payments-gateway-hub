import { Mocked } from 'vitest';

import { IWebhookProvisioningPort } from '@/modules/backoffice/application/ports/webhook-provisioning.port';

export function createWebhookProvisioningPortMock(): Mocked<IWebhookProvisioningPort> {
	return {
		provision: vi.fn(),
		supports: vi.fn(),
	};
}
