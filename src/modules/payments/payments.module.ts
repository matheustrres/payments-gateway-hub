import { forwardRef, Module } from '@nestjs/common';

import { PaymentOrchestratorService } from './application/services/payment-orchestrator.service';
import { CreateChargeController } from './application/use-cases/create-charge/create-charge.controller';
import { CreateChargeUseCase } from './application/use-cases/create-charge/create-charge.use-case';
import { FindChargesController } from './application/use-cases/find-charges/find-charges.controller';
import { FindChargesUseCase } from './application/use-cases/find-charges/find-charges.use-case';
import { ITransactionHistoriesRepository } from './domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from './domain/repositories/transactions.repository';
import { AbacatePayPaymentGatewayAdapter } from './infra/adapters/payment-gateways/abacate-pay.adapter';
import { AsaasPaymentGatewayAdapter } from './infra/adapters/payment-gateways/asaas.adapter';
import { PgSqlTransactionHistoriesRepository } from './infra/database/repositories/transaction-histories.repository';
import { PgSqlTransactionsRepository } from './infra/database/repositories/transactions.repository';

import { BackofficeModule } from '../backoffice/backoffice.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { EnvModule } from '@/shared/modules/env/env.module';
import { HttpRequestingModule } from '@/shared/modules/requesting/requesting.module';

@Module({
	imports: [
		HttpRequestingModule,
		EnvModule,
		forwardRef(() => BackofficeModule),
		forwardRef(() => WebhooksModule),
	],
	providers: [
		{
			provide: AbacatePayPaymentGatewayAdapter.name,
			useClass: AbacatePayPaymentGatewayAdapter,
		},
		{
			provide: AsaasPaymentGatewayAdapter.name,
			useClass: AsaasPaymentGatewayAdapter,
		},
		{
			provide: ITransactionsRepository,
			useClass: PgSqlTransactionsRepository,
		},
		{
			provide: ITransactionHistoriesRepository,
			useClass: PgSqlTransactionHistoriesRepository,
		},
		PaymentOrchestratorService,
		CreateChargeUseCase,
		FindChargesUseCase,
	],
	controllers: [CreateChargeController, FindChargesController],
	exports: [
		ITransactionsRepository,
		PaymentOrchestratorService,
		ITransactionHistoriesRepository,
	],
})
export class PaymentsModule {}
