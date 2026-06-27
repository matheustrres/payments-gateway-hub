import { Mocked } from 'vitest';

import { EnvService } from '@/shared/modules/env/env.service';

export function createEnvServiceMock(): Mocked<EnvService> {
	return {
		getKeyOrThrow: vi.fn(),
	} as unknown as Mocked<EnvService>;
}
