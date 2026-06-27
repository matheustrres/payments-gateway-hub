import {
	BadRequestException,
	Inject,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from '@nestjs/common';

import { MoneyVo } from '@/core/domain/entities/value-objects/money';
import {
	EPaymentMethod,
	EPaymentProvider,
	EPaymentStatus,
} from '@/core/enums/payment';
import { EncryptedCredentials } from '@/core/types';
import { IUseCase } from '@/core/use-case';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';
import {
	CreateChargeUseCaseInput,
	CreateChargeUseCaseOutput,
	PixChargeDetails,
	BoletoChargeDetails,
	CreditCardChargeDetails,
} from '@/modules/payments/application/dtos/create-charge.dto';
import {
	BoletoPaymentGatewayInput,
	CreditCardPaymentGatewayInput,
	PaymentInput,
	PixPaymentGatewayInput,
} from '@/modules/payments/application/dtos/payment-input.dto';
import { PaymentGatewayResponse } from '@/modules/payments/application/ports/payment-gateway.port';
import { PaymentOrchestratorService } from '@/modules/payments/application/services/payment-orchestrator.service';
import { TransactionHistoryEntity } from '@/modules/payments/domain/entities/transaction-history.entity';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';
import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookQueueProducerPort } from '@/modules/webhooks/application/ports/queue-producer.port';

import { errorMessages } from '@/shared/utils/err-messages';

@Injectable()
export class CreateChargeUseCase implements IUseCase<
	CreateChargeUseCaseInput,
	CreateChargeUseCaseOutput
> {
	private readonly logger = new Logger(CreateChargeUseCase.name);

	constructor(
		// Implementar cacheamento para evitar chamadas duplicadas com a mesma idempotencyKey
		private readonly paymentsOrchestratorService: PaymentOrchestratorService,
		private readonly projectsRepository: IProjectsRepository,
		private readonly transactionsRepository: ITransactionsRepository,
		private readonly transactionHistoriesRepository: ITransactionHistoriesRepository,
		private readonly providersCredentialsRepository: IProvidersCredentialsRepository,
		private readonly encryptionService: IEncryptionServicePort,
		@Inject('WEBHOOK_QUEUE_PRODUCERS')
		private readonly queueProducer: IWebhookQueueProducerPort,
	) {}

	async exec(
		input: CreateChargeUseCaseInput,
	): Promise<CreateChargeUseCaseOutput> {
		const project = await this.projectsRepository.findById(input.projectId);
		if (!project) {
			throw new NotFoundException(errorMessages.projects.notFound);
		}
		let transaction = await this.transactionsRepository.findByIdempotencyKey(
			input.idempotencyKey,
		);
		if (!transaction) {
			const provider = this.predictPaymentProvider(input.paymentMethod);
			transaction = this.createPendingTransaction(input, project, provider);
			try {
				await this.transactionsRepository.insertOne(transaction);
				await this.recordTransactionCreation(transaction);
			} catch (error) {
				this.logger.error(
					`[DEBUG] Failed to insert transaction: ${transaction.id}`,
					error,
				);
				if (this.isDuplicateKeyError(error)) {
					const found = await this.transactionsRepository.findByIdempotencyKey(
						input.idempotencyKey,
					);
					if (found) return this.buildResponse(found);
				}
				throw new InternalServerErrorException(
					errorMessages.transactions.creationFailed,
				);
			}
		} else {
			const isTransactionPaidOrPending = [
				EPaymentStatus.Paid,
				EPaymentStatus.Pending,
			].includes(transaction.status);
			if (isTransactionPaidOrPending) {
				return this.buildResponse(transaction);
			}
			if (transaction.status === EPaymentStatus.Failed) {
				this.logger.log(`Retrying failed transaction: ${transaction.id}`);
				transaction.setStatus(EPaymentStatus.Pending);
				transaction.setPaymentData({});
				await this.transactionsRepository.updateOne(transaction);
			}
		}
		const isProduction = input.isProduction ?? false;
		const provider = transaction.provider;
		const providerCredentials =
			await this.providersCredentialsRepository.findByProjectIdAndProvider(
				input.projectId,
				provider,
				isProduction,
			);
		if (!providerCredentials) {
			const previousStatus = transaction.status;
			transaction.setStatus(EPaymentStatus.Failed);
			transaction.setPaymentData({
				error: 'Provider credentials not found',
				failedAt: new Date().toISOString(),
			});
			await this.transactionsRepository.updateOne(transaction);
			await this.recordStatusChange(
				transaction,
				previousStatus,
				'Provider credentials not found',
			);
			throw new BadRequestException(
				errorMessages.providersCredentials.notFoundForProviderAndProject,
			);
		}
		try {
			const rawApiKey = this.fetchRawApiKeyFromCredentials(
				providerCredentials.encryptedCredentials,
			);
			const orchestratorInput = this.buildOrchestratorInput(input, rawApiKey);
			const gatewayResponse =
				await this.paymentsOrchestratorService.processPayment(
					orchestratorInput,
				);
			transaction = await this.updateTransactionWithGatewayData(
				transaction,
				gatewayResponse,
			);
			if (transaction.status === EPaymentStatus.Paid) {
				await this.queueProducer.dispatch({
					transactionId: transaction.id.toString(),
					projectId: project.id.toString(),
				});
			}
		} catch (error) {
			this.logger.error(
				`Gateway error for transaction ${transaction.id}:`,
				error,
			);
			const previousStatus = transaction.status;
			transaction.setStatus(EPaymentStatus.Failed);
			transaction.setPaymentData({
				error: (error as Error).message,
				failedAt: new Date().toISOString(),
			});
			await this.transactionsRepository.updateOne(transaction);
			await this.recordStatusChange(
				transaction,
				previousStatus,
				(error as Error).message,
			);
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException(
				'Failed to process payment with gateway',
			);
		}
		return this.buildResponse(transaction);
	}

	private buildOrchestratorInput(
		input: CreateChargeUseCaseInput,
		apiKey: string,
	): PaymentInput {
		const common = {
			apiKey,
			amountInCents: input.amountInCents,
			currency: input.currency,
			idempotencyKey: input.idempotencyKey,
			isSandbox: !(input.isProduction ?? false),
		};
		switch (input.paymentMethod) {
			case EPaymentMethod.Pix:
				const pixDetails = input.details as PixChargeDetails;
				return {
					...common,
					paymentMethod: EPaymentMethod.Pix,
					productName: pixDetails.productName,
					returnUrl: pixDetails.returnUrl,
					completionUrl: pixDetails.completionUrl,
					customer: {
						cellphone: pixDetails.customer?.cellphone || '',
						email: pixDetails.customer?.email || '',
						name: pixDetails.customer?.name || '',
						taxId: pixDetails.customer?.taxId || '',
					},
				} satisfies PixPaymentGatewayInput;
			case EPaymentMethod.Boleto:
				const boletoDetails = input.details as BoletoChargeDetails;
				return {
					...common,
					paymentMethod: EPaymentMethod.Boleto,
					customer: boletoDetails.customer,
					description: boletoDetails.description,
					dueDate: boletoDetails.dueDate,
				} satisfies BoletoPaymentGatewayInput;
			case EPaymentMethod.Card:
				const cardDetails = input.details as CreditCardChargeDetails;
				return {
					...common,
					paymentMethod: EPaymentMethod.Card,
					customer: cardDetails.customer,
					card: cardDetails.card,
					description: cardDetails.description,
				} satisfies CreditCardPaymentGatewayInput;
			default:
				throw new BadRequestException('Invalid payment method');
		}
	}

	private predictPaymentProvider(
		paymentMethod: EPaymentMethod,
	): EPaymentProvider {
		switch (paymentMethod) {
			case EPaymentMethod.Pix:
				return EPaymentProvider.AbacatePay;
			case EPaymentMethod.Boleto:
			case EPaymentMethod.Card:
				return EPaymentProvider.Asaas;
			default:
				throw new BadRequestException('Provider not mapped for this method');
		}
	}

	private createPendingTransaction(
		input: CreateChargeUseCaseInput,
		project: ProjectEntity,
		provider: EPaymentProvider,
	): TransactionEntity {
		return TransactionEntity.createOne({
			amountInCents: MoneyVo.create(input.amountInCents, input.currency),
			currency: input.currency,
			customerEmail: this.extractCustomerEmail(input),
			customerTaxId: this.extractCustomerTaxId(input),
			externalId: '', // Será preenchido pós-gateway
			externalStatus: '',
			idempotencyKey: input.idempotencyKey,
			paymentData: {},
			paymentMethod: input.paymentMethod,
			paymentUrl: '',
			project,
			provider,
			status: EPaymentStatus.Pending,
		});
	}

	private extractCustomerEmail(input: CreateChargeUseCaseInput): string {
		if (input.paymentMethod === EPaymentMethod.Pix) {
			return (input.details as PixChargeDetails).customer?.email || '';
		}
		return (input.details as BoletoChargeDetails | CreditCardChargeDetails)
			.customer.email;
	}

	private extractCustomerTaxId(input: CreateChargeUseCaseInput): string {
		if (input.paymentMethod === EPaymentMethod.Pix) {
			return (input.details as PixChargeDetails).customer?.taxId || '';
		}
		return (input.details as BoletoChargeDetails | CreditCardChargeDetails)
			.customer.taxId;
	}

	private fetchRawApiKeyFromCredentials(
		encryptedCredentials: EncryptedCredentials,
	): string {
		const decryptedJsonString =
			this.encryptionService.decrypt(encryptedCredentials);
		const credentialsObj = JSON.parse(decryptedJsonString);
		const rawApiKey = credentialsObj['apiKey'] || credentialsObj['accessToken'];
		if (!rawApiKey) {
			throw new BadRequestException(
				errorMessages.providersCredentials.missingApiKey,
			);
		}
		return rawApiKey;
	}

	private async updateTransactionWithGatewayData(
		transaction: TransactionEntity,
		gatewayResponse: PaymentGatewayResponse,
	): Promise<TransactionEntity> {
		transaction.setExternalId(gatewayResponse.externalId);
		transaction.setStatus(gatewayResponse.status as EPaymentStatus);
		transaction.setPaymentData(gatewayResponse.metadata);
		transaction.setCustomerEmail(gatewayResponse.customer.email);
		transaction.setCustomerTaxId(gatewayResponse.customer.taxId);
		transaction.setPaymentUrl(gatewayResponse.paymentUrl);
		await this.transactionsRepository.updateOne(transaction);
		return transaction;
	}

	private buildResponse(
		transaction: TransactionEntity,
	): CreateChargeUseCaseOutput {
		return {
			transaction: {
				...transaction.toSummary(),
				amount: transaction.amountInCents.toJSON(),
			},
		};
	}

	private isDuplicateKeyError(error: any): boolean {
		return (
			error.code === 'P2002' ||
			error.message?.includes('unique constraint') ||
			error.message?.includes('Duplicate entry')
		);
	}

	private async recordTransactionCreation(
		transaction: TransactionEntity,
	): Promise<void> {
		const history = TransactionHistoryEntity.createNew({
			transactionId: transaction.id,
			fromStatus: 'NONE',
			toStatus: transaction.status,
			trigger: 'API_CREATE',
		});
		await this.transactionHistoriesRepository.insertOne(history);
	}

	private async recordStatusChange(
		transaction: TransactionEntity,
		previousStatus: EPaymentStatus,
		errorMessage: string,
	): Promise<void> {
		const history = TransactionHistoryEntity.createNew({
			transactionId: transaction.id,
			fromStatus: previousStatus,
			toStatus: transaction.status,
			trigger: 'API_CREATE',
			metadata: { error: errorMessage },
		});
		await this.transactionHistoriesRepository.insertOne(history);
	}
}
