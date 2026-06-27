import { Mocked } from 'vitest';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';

export function createEncryptionServiceMock(): Mocked<IEncryptionServicePort> {
	return {
		encrypt: vi.fn(),
		decrypt: vi.fn(),
	};
}
