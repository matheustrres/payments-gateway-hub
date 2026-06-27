import { Mocked } from 'vitest';

import { ITokenService } from '@/modules/backoffice/application/ports/token-service.port';

export function createTokenServiceMock(): Mocked<ITokenService> {
	return {
		sign: vi.fn(),
		verify: vi.fn(),
		decode: vi.fn(),
	};
}
