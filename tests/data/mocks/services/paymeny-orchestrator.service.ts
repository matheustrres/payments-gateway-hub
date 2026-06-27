import { Mocked } from 'vitest';

import { PaymentOrchestratorService } from '@/modules/payments/application/services/payment-orchestrator.service';

export function createPaymentOrchestratorServiceMock(): Mocked<PaymentOrchestratorService> {
	return {
		processPayment: vi.fn(),
	} as any;
}
