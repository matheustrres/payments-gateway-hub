import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	RawBodyRequest,
	UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { IWebhookSignatureStrategy } from '../../strategies/webhook-signature.strategy';

import { EPaymentProvider } from '@/core/enums/payment';

import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
	constructor(
		private readonly credentialsRepository: IProvidersCredentialsRepository,
		@Inject('WEBHOOK_SIGNATURE_STRATEGIES')
		private readonly strategies: IWebhookSignatureStrategy[],
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<RawBodyRequest<Request>>();
		const projectId = request.params['projectId'];
		const providerStr = request.params['provider'];
		if (!projectId || !providerStr) {
			throw new BadRequestException('Missing projectId or provider in URL');
		}
		const provider = providerStr as EPaymentProvider;
		const strategy = this.strategies.find((s) => s.supports(provider));
		if (!strategy) {
			throw new BadRequestException(
				`No signature strategy found for provider: ${provider}`,
			);
		}
		const credentials = await this.fetchCredentials(projectId, provider);
		const isSignatureValid = await strategy.verifySignature(
			credentials,
			request,
		);
		if (!isSignatureValid) {
			throw new UnauthorizedException('Invalid Webhook Signature');
		}
		return true;
	}

	private async fetchCredentials(
		projectId: string,
		provider: EPaymentProvider,
	) {
		const results = await Promise.all([
			this.credentialsRepository.findByProjectIdAndProvider(
				projectId,
				provider,
				true,
			),
			this.credentialsRepository.findByProjectIdAndProvider(
				projectId,
				provider,
				false,
			),
		]);
		const valid = results.filter((c) => !!c);
		if (!valid.length) {
			throw new UnauthorizedException(
				'No credentials configured for this project/provider',
			);
		}
		return valid;
	}
}
