import { forwardRef, Module, Provider } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ProcessInboundWebhookController } from './application/use-cases/process-inbound-webhook/process-inbound-webhook.controller';
import { ProcessInboundWebhookUseCase } from './application/use-cases/process-inbound-webhook/process-inbound-webhook.use-case';
import { IWebhookDeliveryLogsRepository } from './domain/repositories/webhook-delivery-logs.repository';
import { IWebhookEventsRepository } from './domain/repositories/webhook-events.repository';
import { AbacatePayWebhookParser } from './infra/adapters/parsers/abacate-pay-parser.adapter';
import { AsaasWebhookParser } from './infra/adapters/parsers/asaas-parser.adapter';
import { SqsWebhookConsumerJob } from './infra/adapters/queues/consumers/sqs-webhook-consumer.job';
import { SqsDlqMonitorJob } from './infra/adapters/queues/monitor/sqs-dlq-monitor.job';
import { SqsWebhookProducerAdapter } from './infra/adapters/queues/producers/sqs-webhook-producer.adapter';
import { SqsClientProvider } from './infra/adapters/queues/sqs-client.provider';
import { PgSqlWebhookDeliveryLogsRepository } from './infra/database/repositories/webhook-delivery-logs.repository';
import { PgSqlWebhookEventsRepository } from './infra/database/repositories/webhook-events.repository';
import { AbacatePaySignatureStrategy } from './infra/strategies/signatures/abacate-pay-signature.strategy';
import { AsaasSignatureStrategy } from './infra/strategies/signatures/asaas-signature.strategy';
import { WebhookRetryWorker } from './infra/workers/webhook-retry.worker';

import { BackofficeModule } from '../backoffice/backoffice.module';
import { PaymentsModule } from '../payments/payments.module';

import { EnvModule } from '@/shared/modules/env/env.module';
import { HttpRequestingModule } from '@/shared/modules/requesting/requesting.module';

const WebhookSignatureStrategiesProvider: Provider = {
	provide: 'WEBHOOK_SIGNATURE_STRATEGIES',
	useFactory: (
		abacateStrategy: AbacatePaySignatureStrategy,
		asaasStrategy: AsaasSignatureStrategy,
	) => {
		return [abacateStrategy, asaasStrategy];
	},
	inject: [AbacatePaySignatureStrategy, AsaasSignatureStrategy],
};
const WebhookParsersProvider: Provider = {
	provide: 'WEBHOOK_PARSERS',
	useFactory: (
		abacatePay: AbacatePayWebhookParser,
		asaas: AsaasWebhookParser,
	) => [abacatePay, asaas],
	inject: [AbacatePayWebhookParser, AsaasWebhookParser],
};
const WebhookQueueProducerProvider: Provider = {
	provide: 'WEBHOOK_QUEUE_PRODUCERS',
	useFactory: (sqsQueueProducer: SqsWebhookProducerAdapter) => {
		return sqsQueueProducer;
	},
	inject: [SqsWebhookProducerAdapter],
};

@Module({
	imports: [
		ScheduleModule.forRoot(),
		EnvModule,
		HttpRequestingModule,
		forwardRef(() => BackofficeModule),
		forwardRef(() => PaymentsModule),
	],
	providers: [
		{
			provide: IWebhookEventsRepository,
			useClass: PgSqlWebhookEventsRepository,
		},
		{
			provide: IWebhookDeliveryLogsRepository,
			useClass: PgSqlWebhookDeliveryLogsRepository,
		},
		WebhookRetryWorker,
		WebhookSignatureStrategiesProvider,
		WebhookParsersProvider,
		WebhookQueueProducerProvider,
		SqsClientProvider,
		AbacatePayWebhookParser,
		AbacatePaySignatureStrategy,
		AsaasWebhookParser,
		AsaasSignatureStrategy,
		SqsWebhookProducerAdapter,
		SqsWebhookConsumerJob,
		SqsDlqMonitorJob,
		ProcessInboundWebhookUseCase,
	],
	controllers: [ProcessInboundWebhookController],
	exports: [
		IWebhookEventsRepository,
		IWebhookDeliveryLogsRepository,
		WebhookQueueProducerProvider,
	],
})
export class WebhooksModule {}
