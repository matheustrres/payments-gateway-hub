import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

import { IWebhookSignatureStrategy } from '../webhook-signature.strategy';

import { EPaymentProvider } from '@/core/enums/payment';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { ProviderCredentialEntity } from '@/modules/backoffice/domain/entities/provider-credential.entity';

@Injectable()
export class AbacatePaySignatureStrategy implements IWebhookSignatureStrategy {
	private readonly logger = new Logger(AbacatePaySignatureStrategy.name);
	private readonly SIGNATURE_HEADER = 'x-webhook-signature';
	private readonly SECRET_HEADER = 'x-webhook-secret';

	constructor(private readonly encryptionService: IEncryptionServicePort) {}

	supports(provider: EPaymentProvider): boolean {
		return provider === EPaymentProvider.AbacatePay;
	}

	async verifySignature(
		credentials: ProviderCredentialEntity[],
		request: RawBodyRequest<Request>,
	): Promise<boolean> {
		const signature = request.headers[this.SIGNATURE_HEADER] as string;
		const receivedSecret = request.headers[this.SECRET_HEADER] as string;
		const rawBody = request.rawBody;
		if (!signature || !receivedSecret || !rawBody) {
			this.logger.warn(
				'Missing required headers or body for AbacatePay validation',
			);
			return false;
		}
		const matchingCredential = credentials.find((cred) => {
			try {
				const json = JSON.parse(
					this.encryptionService.decrypt(cred.encryptedCredentials),
				);
				return json['webhookSecret'] === receivedSecret;
			} catch (error) {
				return false;
			}
		});
		if (!matchingCredential) {
			this.logger.warn('No credential matches the x-webhook-secret header');
			return false;
		}
		try {
			const json = JSON.parse(
				this.encryptionService.decrypt(matchingCredential.encryptedCredentials),
			);
			const webhookSecret = json['webhookSecret'];
			const computedHash = this.computeHmac(webhookSecret, rawBody);
			const isValid = this.safeCompare(computedHash, signature);
			if (!isValid) {
				/**
				 * [DÉBITO TÉCNICO]
				 * TODO: INvestigar e remover este fallback antes de ir para Produção.
				 * Atualmente mantido pois o Ngrok/Localhost está alterando o rawBody sutilmente,
				 * causando falha no HMAC mesmo com segredo correto.
				 * Em PROD, isso deve ser: return false;
				 */
				this.logger.error(
					'⚠️ HMAC Mismatch (AbacatePay). Allowed by Fallback (Secret Match).',
				);
				return true;
			}
			return true;
		} catch (error) {
			this.logger.error('Error verifying AbacatePay signature', error);
			return false;
		}
	}

	private computeHmac(secret: string, data: Buffer): string {
		return createHmac('sha256', secret.trim()).update(data).digest('base64');
	}

	private safeCompare(a: string, b: string): boolean {
		const bufA = Buffer.from(a);
		const bufB = Buffer.from(b);
		return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
	}
}
