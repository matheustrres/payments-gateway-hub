import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

import { EPaymentProvider } from '@/core/enums/payment';

import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

export abstract class IWebhookSignatureStrategy {
	abstract supports(provider: EPaymentProvider): boolean;
	abstract verifySignature(
		credentials: ProviderCredentialEntity[],
		request: RawBodyRequest<Request>,
	): Promise<boolean>;
}
