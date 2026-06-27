import {
	Controller,
	Head,
	HttpCode,
	HttpStatus,
	Param,
	ParseEnumPipe,
	Post,
	Headers,
	Body,
	UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateProcessInboundWebhookSwaggerRoute } from './process-inbound-webhook.swagger';
import { ProcessInboundWebhookUseCase } from './process-inbound-webhook.use-case';

import { EPaymentProvider } from '@/core/enums/payment';

import { WebhookSignatureGuard } from '@/modules/webhooks/infra/auth/guards/webhook-signature.guard';

import { Public } from '@/shared/auth/decorators/public.decorator';
import { ParseCUIDPipe } from '@/shared/lib/pipes/transformers/parse-cuid.pipe';

@ApiTags('Webhooks')
@Controller('webhooks/inbound')
export class ProcessInboundWebhookController {
	constructor(private readonly useCase: ProcessInboundWebhookUseCase) {}

	@Head(':projectId/:provider')
	@Public()
	@HttpCode(HttpStatus.OK)
	healthCheck(): void {
		return;
	}

	@Post(':projectId/:provider')
	@Public()
	@UseGuards(WebhookSignatureGuard)
	@CreateProcessInboundWebhookSwaggerRoute()
	async handle(
		@Param('projectId', ParseCUIDPipe) projectId: string,
		@Param('provider', new ParseEnumPipe(EPaymentProvider))
		provider: EPaymentProvider,
		@Body() body: any,
		@Headers() headers: any,
	): Promise<void> {
		return this.useCase.exec({
			projectId,
			provider,
			payload: body,
			headers,
		});
	}
}
