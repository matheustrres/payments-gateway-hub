import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { IEncryptionServicePort } from './application/ports/encryption-service.port';
import { ITokenService } from './application/ports/token-service.port';
import { IWebhookProvisioningPort } from './application/ports/webhook-provisioning.port';
import { AdminLoginController } from './application/use-cases/admin-login/admin-login.controller';
import { AdminLoginUseCase } from './application/use-cases/admin-login/admin-login.use-case';
import { CreateProjectController } from './application/use-cases/create-project/create-project.controller';
import { CreateProjectUseCase } from './application/use-cases/create-project/create-project.use-case';
import { GetAdminAuditLogsController } from './application/use-cases/get-admin-audit-logs/get-admin-audit-logs.controller';
import { GetAdminAuditLogsUseCase } from './application/use-cases/get-admin-audit-logs/get-admin-audit-logs.use-case';
import { GetTransactionAuditSummaryController } from './application/use-cases/get-transaction-audit-summary/get-transaction-audit-summary.controller';
import { GetTransactionAuditSummaryUseCase } from './application/use-cases/get-transaction-audit-summary/get-transaction-audit-summary.use-case';
import { UpsertProviderCredentialController } from './application/use-cases/upser-provider-credential/upsert-provider-credential.controller';
import { UpsertProviderCredentialsUseCase } from './application/use-cases/upser-provider-credential/upsert-provider-credential.use-case';
import { IAdminAuditsRepository } from './domain/repositories/admin-audits.repository';
import { IAdminsRepository } from './domain/repositories/admins.repository';
import { IProjectsRepository } from './domain/repositories/projects.repository';
import { IProvidersCredentialsRepository } from './domain/repositories/providers-credentials.repository';
import { AesEncryptionServiceAdapter } from './infra/adapters/encryption-service/aes-encryption-service.adapter';
import { JwtTokenServiceAdapter } from './infra/adapters/token-service/jwt-token-service.adapter';
import { AsaasWebhookProvisioningAdapter } from './infra/adapters/webhook-provisioning/asaas-webhook-provisioning.adapter';
import { AdminAuthGuard } from './infra/auth/guards/admin-auth.guard';
import { AdminAuditInterceptor } from './infra/auth/interceptors/admin-audit.interceptor';
import { PgSqlAdminAuditsRepository } from './infra/database/repositories/admin-audits.repository';
import { PgSqlAdminsRepository } from './infra/database/repositories/admins.repository';
import { PgSqlProjectsRepository } from './infra/database/repositories/projects.repository';
import { PgSqlProvidersCredentialsRepository } from './infra/database/repositories/providers-credentials.repository';

import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { DatabaseModule } from '@/shared/modules/database/database.module';
import { EnvModule } from '@/shared/modules/env/env.module';
import { HttpRequestingModule } from '@/shared/modules/requesting/requesting.module';

@Module({
	imports: [
		DatabaseModule,
		EnvModule,
		HttpRequestingModule,
		forwardRef(() => PaymentsModule),
		forwardRef(() => WebhooksModule),
	],
	providers: [
		{
			provide: IAdminsRepository,
			useClass: PgSqlAdminsRepository,
		},
		{
			provide: IProjectsRepository,
			useClass: PgSqlProjectsRepository,
		},
		{
			provide: IProvidersCredentialsRepository,
			useClass: PgSqlProvidersCredentialsRepository,
		},
		{
			provide: IAdminAuditsRepository,
			useClass: PgSqlAdminAuditsRepository,
		},
		{
			provide: IEncryptionServicePort,
			useClass: AesEncryptionServiceAdapter,
		},
		{
			provide: ITokenService,
			useClass: JwtTokenServiceAdapter,
		},
		{
			provide: IWebhookProvisioningPort,
			useClass: AsaasWebhookProvisioningAdapter,
		},
		{
			provide: APP_GUARD,
			useClass: AdminAuthGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: AdminAuditInterceptor,
		},
		AdminLoginUseCase,
		CreateProjectUseCase,
		UpsertProviderCredentialsUseCase,
		GetTransactionAuditSummaryUseCase,
		GetAdminAuditLogsUseCase,
	],
	controllers: [
		AdminLoginController,
		CreateProjectController,
		UpsertProviderCredentialController,
		GetTransactionAuditSummaryController,
		GetAdminAuditLogsController,
	],
	exports: [
		IAdminsRepository,
		IProjectsRepository,
		IProvidersCredentialsRepository,
		IEncryptionServicePort,
		ITokenService,
	],
})
export class BackofficeModule {}
