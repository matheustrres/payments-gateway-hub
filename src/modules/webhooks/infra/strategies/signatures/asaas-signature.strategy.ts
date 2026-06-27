import { Injectable, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

import { IWebhookSignatureStrategy } from '../webhook-signature.strategy';

import { EPaymentProvider } from '@/core/enums/payment';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

@Injectable()
export class AsaasSignatureStrategy implements IWebhookSignatureStrategy {
	private readonly AUTH_HEADER = 'asaas-access-token';

	constructor(private readonly encryptionService: IEncryptionServicePort) {}

	supports(provider: EPaymentProvider): boolean {
		return provider === EPaymentProvider.Asaas;
	}

	async verifySignature(
		credentials: ProviderCredentialEntity[],
		request: RawBodyRequest<Request>,
	): Promise<boolean> {
		const receivedToken = request.headers[this.AUTH_HEADER] as string;
		if (!receivedToken) return false;
		const matchingCredential = credentials.find((cred) => {
			try {
				const json = JSON.parse(
					this.encryptionService.decrypt(cred.encryptedCredentials),
				);
				return json['webhookSecret'] === receivedToken;
			} catch (error) {
				return false;
			}
		});
		if (matchingCredential) return true;
		return false;
	}
}
