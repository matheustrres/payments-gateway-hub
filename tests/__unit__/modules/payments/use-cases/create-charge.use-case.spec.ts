import { NotFoundException } from '@nestjs/common';
import { Mocked } from 'vitest';

import {
	ECurrency,
	EPaymentMethod,
	EPaymentProvider,
	EPaymentStatus,
} from '@/core/enums/payment';

import { IEncryptionServicePort } from '@/modules/backoffice/application/ports/encryption-service.port';
import { IProjectsRepository } from '@/modules/backoffice/domain/repositories/projects.repository';
import { IProvidersCredentialsRepository } from '@/modules/backoffice/domain/repositories/providers-credentials.repository';
import {
	CreateChargeUseCaseInput,
	PixChargeDetails,
	CreditCardChargeDetails,
} from '@/modules/payments/application/dtos/create-charge.dto';
import { PaymentGatewayResponse } from '@/modules/payments/application/ports/payment-gateway.port';
import { PaymentOrchestratorService } from '@/modules/payments/application/services/payment-orchestrator.service';
import { CreateChargeUseCase } from '@/modules/payments/application/use-cases/create-charge/create-charge.use-case';
import { ITransactionHistoriesRepository } from '@/modules/payments/domain/repositories/transaction-histories.repository';
import { ITransactionsRepository } from '@/modules/payments/domain/repositories/transactions.repository';
import { IWebhookQueueProducerPort } from '@/modules/webhooks/application/ports/queue-producer.port';

import { errorMessages } from '@/shared/utils/err-messages';

import { ProjectEntityBuilder } from '#/data/builders/entities/project.entity.builder';
import { ProviderCredentialEntityBuilder } from '#/data/builders/entities/provider-credential.entity.builder';
import { TransactionEntityBuilder } from '#/data/builders/entities/transaction.entity.builder';
import { createMockWebhookQueueProducerPort } from '#/data/mocks/ports/webhook-queue-producer.port';
import { createProjectsRepositoryMock } from '#/data/mocks/repositories/projects.repository';
import { createProvidersCredentialsRepositoryMock } from '#/data/mocks/repositories/providers-credentials.repository';
import { createTransactionHistoriesRepositoryMock } from '#/data/mocks/repositories/transaction-histories.repository';
import { createTransactionsRepositoryMock } from '#/data/mocks/repositories/transactions.repository';
import { createEncryptionServiceMock } from '#/data/mocks/services/encryption-service';
import { createPaymentOrchestratorServiceMock } from '#/data/mocks/services/paymeny-orchestrator.service';

describe(CreateChargeUseCase.name, () => {
	let sut: CreateChargeUseCase;
	let projectsRepository: Mocked<IProjectsRepository>;
	let transactionsRepository: Mocked<ITransactionsRepository>;
	let transactionHistoriesRepository: Mocked<ITransactionHistoriesRepository>;
	let paymentsOrchestratorService: Mocked<PaymentOrchestratorService>;
	let providersCredentialsRepository: Mocked<IProvidersCredentialsRepository>;
	let encryptionService: Mocked<IEncryptionServicePort>;
	let queueProducer: Mocked<IWebhookQueueProducerPort>;

	const defaultProject = new ProjectEntityBuilder().build();
	const defaultProviderCredential = new ProviderCredentialEntityBuilder()
		.withProvider(EPaymentProvider.AbacatePay)
		.build();

	const defaultPixDetails: PixChargeDetails = {
		productName: 'Test Product',
		returnUrl: 'https://example.com/return',
		completionUrl: 'https://example.com/completion',
		customer: {
			name: 'John Doe',
			email: 'john@example.com',
			cellphone: '11999999999',
			taxId: '12345678901',
		},
	};

	const defaultInput: CreateChargeUseCaseInput = {
		projectId: defaultProject.id.toString(),
		amountInCents: 10000,
		currency: ECurrency.BRL,
		idempotencyKey: 'idempotency-key-123',
		paymentMethod: EPaymentMethod.Pix,
		details: defaultPixDetails,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		projectsRepository = createProjectsRepositoryMock();
		transactionsRepository = createTransactionsRepositoryMock();
		transactionHistoriesRepository = createTransactionHistoriesRepositoryMock();
		paymentsOrchestratorService = createPaymentOrchestratorServiceMock();
		providersCredentialsRepository = createProvidersCredentialsRepositoryMock();
		encryptionService = createEncryptionServiceMock();
		queueProducer = createMockWebhookQueueProducerPort() as any;

		projectsRepository.findById.mockResolvedValue(defaultProject);
		providersCredentialsRepository.findByProjectIdAndProvider.mockResolvedValue(
			defaultProviderCredential,
		);
		encryptionService.decrypt.mockReturnValue(
			JSON.stringify({ apiKey: 'test-api-key' }),
		);
		transactionsRepository.findByIdempotencyKey.mockResolvedValue(null);
		transactionsRepository.insertOne.mockResolvedValue(undefined as any);
		transactionsRepository.updateOne.mockResolvedValue(undefined as any);
		transactionHistoriesRepository.insertOne.mockResolvedValue(
			undefined as any,
		);
		// Default successful gateway response
		paymentsOrchestratorService.processPayment.mockResolvedValue({
			externalId: 'pay_default',
			status: EPaymentStatus.Pending,
			paymentUrl: 'http://example.com',
			customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
			metadata: {},
		});

		sut = new CreateChargeUseCase(
			paymentsOrchestratorService,
			projectsRepository,
			transactionsRepository,
			transactionHistoriesRepository,
			providersCredentialsRepository,
			encryptionService,
			queueProducer,
		);
	});

	describe('Validation & Credentials', () => {
		it('should throw if project does not exist', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(null);
			await expect(sut.exec(defaultInput)).rejects.toThrow(NotFoundException);
		});

		it('should throw BadRequestException if provider credentials are not found', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			vi.spyOn(transactionsRepository, 'insertOne').mockResolvedValueOnce(
				undefined as any,
			);
			vi.spyOn(
				providersCredentialsRepository,
				'findByProjectIdAndProvider',
			).mockResolvedValueOnce(null);
			const updateSpy = vi.spyOn(transactionsRepository, 'updateOne');
			await expect(sut.exec(defaultInput)).rejects.toThrow(
				errorMessages.providersCredentials.notFoundForProviderAndProject,
			);
			expect(updateSpy).toHaveBeenCalled();
		});
	});

	describe('Routing & Environment', () => {
		it('should predict AbacatePay for Pix and set isSandbox correctly', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			const abacateCred = new ProviderCredentialEntityBuilder()
				.withProvider(EPaymentProvider.AbacatePay)
				.build();
			vi.spyOn(
				providersCredentialsRepository,
				'findByProjectIdAndProvider',
			).mockResolvedValue(abacateCred);
			await sut.exec({ ...defaultInput, isProduction: false });
			expect(paymentsOrchestratorService.processPayment).toHaveBeenCalledWith(
				expect.objectContaining({ isSandbox: true }),
			);
			expect(
				providersCredentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledWith(
				expect.any(String),
				EPaymentProvider.AbacatePay,
				false,
			);
		});

		it('should predict Asaas for Boleto and Credit Card', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			const asaasCred = new ProviderCredentialEntityBuilder()
				.withProvider(EPaymentProvider.Asaas)
				.build();
			vi.spyOn(
				providersCredentialsRepository,
				'findByProjectIdAndProvider',
			).mockResolvedValue(asaasCred);
			const cardInput = {
				...defaultInput,
				paymentMethod: EPaymentMethod.Card,
				details: { customer: defaultPixDetails.customer, card: {} } as any,
			};
			await sut.exec(cardInput);
			expect(
				providersCredentialsRepository.findByProjectIdAndProvider,
			).toHaveBeenCalledWith(expect.any(String), EPaymentProvider.Asaas, false);
		});
	});

	describe('Gateway Input Mapping', () => {
		it('should correctly map Credit Card details to orchestrator input', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			const asaasCred = new ProviderCredentialEntityBuilder()
				.withProvider(EPaymentProvider.Asaas)
				.build();
			vi.spyOn(
				providersCredentialsRepository,
				'findByProjectIdAndProvider',
			).mockResolvedValue(asaasCred);
			const cardDetails: CreditCardChargeDetails = {
				customer: {
					...defaultPixDetails.customer!,
					postalCode: '123',
					addressNumber: '1',
				},
				card: {
					holderName: 'M TORRES',
					number: '4444',
					expiryMonth: '12',
					expiryYear: '2030',
					cvv: '123',
				},
			};
			await sut.exec({
				...defaultInput,
				paymentMethod: EPaymentMethod.Card,
				details: cardDetails,
			});
			expect(paymentsOrchestratorService.processPayment).toHaveBeenCalledWith(
				expect.objectContaining({
					paymentMethod: EPaymentMethod.Card,
					card: cardDetails.card,
				}),
			);
		});
	});

	describe('Synchronous Dispatch (Queue)', () => {
		it('should dispatch to queue immediately when gateway returns status PAID', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			const gatewayResponse: PaymentGatewayResponse = {
				externalId: 'pay_123',
				status: EPaymentStatus.Paid,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			};
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockResolvedValueOnce(gatewayResponse);
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			expect(dispatchSpy).toHaveBeenCalledWith({
				transactionId: expect.any(String),
				projectId: defaultProject.id.toString(),
			});
			expect(dispatchSpy).toHaveBeenCalledTimes(1);
		});

		it('should NOT dispatch to queue when gateway returns status PENDING', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockResolvedValueOnce({
				externalId: 'pay_pending',
				status: EPaymentStatus.Pending,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			});
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			await sut.exec(defaultInput);
			expect(dispatchSpy).not.toHaveBeenCalled();
		});
	});

	describe('Idempotency & Errors', () => {
		it('should handle duplicate key error by retrying findByIdempotencyKey', async () => {
			const existingTransaction = new TransactionEntityBuilder().build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(transactionsRepository, 'findByIdempotencyKey')
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(existingTransaction);
			vi.spyOn(transactionsRepository, 'insertOne').mockRejectedValueOnce({
				code: 'P2002',
			});
			const result = await sut.exec(defaultInput);
			expect(result.transaction.id).toBe(existingTransaction.id.toString());
			expect(transactionsRepository.findByIdempotencyKey).toHaveBeenCalledTimes(
				2,
			);
		});

		it('should throw InternalServerErrorException when gateway throws unexpected error', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockRejectedValueOnce(new Error('Gateway Down'));
			const updateSpy = vi.spyOn(transactionsRepository, 'updateOne');
			await expect(sut.exec(defaultInput)).rejects.toThrow(
				'Failed to process payment with gateway',
			);
			expect(updateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({ status: EPaymentStatus.Failed }),
				}),
			);
		});
	});

	describe('Transaction Retry Logic', () => {
		it('should return existing transaction immediately if status is PAID', async () => {
			const paidTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Paid)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(paidTransaction);
			const orchestratorSpy = vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			);
			const result = await sut.exec(defaultInput);
			expect(result.transaction.id).toBe(paidTransaction.id.toString());
			expect(result.transaction.status).toBe(EPaymentStatus.Paid);
			expect(orchestratorSpy).not.toHaveBeenCalled();
		});

		it('should return existing transaction immediately if status is PENDING', async () => {
			const pendingTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Pending)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(pendingTransaction);
			const orchestratorSpy = vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			);
			const result = await sut.exec(defaultInput);
			expect(result.transaction.id).toBe(pendingTransaction.id.toString());
			expect(result.transaction.status).toBe(EPaymentStatus.Pending);
			expect(orchestratorSpy).not.toHaveBeenCalled();
		});

		it('should retry FAILED transaction by resetting status to PENDING and clearing payment data', async () => {
			const failedTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Failed)
				.withPaymentData({ error: 'Previous error', failedAt: '2024-01-01' })
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(failedTransaction);
			const updateSpy = vi.spyOn(transactionsRepository, 'updateOne');
			const gatewayResponse: PaymentGatewayResponse = {
				externalId: 'pay_retry_123',
				status: EPaymentStatus.Pending,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			};
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockResolvedValueOnce(gatewayResponse);
			await sut.exec(defaultInput);
			const firstUpdateCall = updateSpy.mock.calls[0]?.[0];
			expect(firstUpdateCall).toBeDefined();
			expect(firstUpdateCall?.status).toBe(EPaymentStatus.Pending);
			expect(firstUpdateCall?.paymentData).toEqual({
				error: 'Previous error',
				failedAt: '2024-01-01',
			});
			expect(updateSpy).toHaveBeenCalledTimes(2);
		});

		it('should call gateway after retrying a FAILED transaction', async () => {
			const failedTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Failed)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(failedTransaction);
			const gatewayResponse: PaymentGatewayResponse = {
				externalId: 'pay_retry_123',
				status: EPaymentStatus.Pending,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			};
			const orchestratorSpy = vi
				.spyOn(paymentsOrchestratorService, 'processPayment')
				.mockResolvedValueOnce(gatewayResponse);
			await sut.exec(defaultInput);
			expect(orchestratorSpy).toHaveBeenCalledTimes(1);
			expect(orchestratorSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					paymentMethod: EPaymentMethod.Pix,
					apiKey: 'test-api-key',
				}),
			);
		});

		it('should dispatch to queue when retried transaction succeeds with PAID status', async () => {
			const failedTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Failed)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(failedTransaction);
			const gatewayResponse: PaymentGatewayResponse = {
				externalId: 'pay_retry_success',
				status: EPaymentStatus.Paid,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			};
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockResolvedValueOnce(gatewayResponse);
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			const result = await sut.exec(defaultInput);
			expect(result.transaction.status).toBe(EPaymentStatus.Paid);
			expect(dispatchSpy).toHaveBeenCalledWith({
				transactionId: expect.any(String),
				projectId: defaultProject.id.toString(),
			});
			expect(dispatchSpy).toHaveBeenCalledTimes(1);
		});

		it('should throw InternalServerErrorException if retry fails', async () => {
			const failedTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Failed)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(failedTransaction);
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockRejectedValueOnce(new Error('Gateway still down'));
			const updateSpy = vi.spyOn(transactionsRepository, 'updateOne');
			await expect(sut.exec(defaultInput)).rejects.toThrow(
				'Failed to process payment with gateway',
			);
			const lastUpdateCall =
				updateSpy.mock.calls[updateSpy.mock.calls.length - 1]?.[0];
			expect(lastUpdateCall).toBeDefined();
			expect(lastUpdateCall?.status).toBe(EPaymentStatus.Failed);
			expect(lastUpdateCall?.paymentData).toEqual(
				expect.objectContaining({
					error: 'Gateway still down',
				}),
			);
		});

		it('should NOT dispatch to queue when retried transaction returns PENDING status', async () => {
			const failedTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Failed)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(failedTransaction);
			const gatewayResponse: PaymentGatewayResponse = {
				externalId: 'pay_retry_pending',
				status: EPaymentStatus.Pending,
				paymentUrl: 'http://url',
				customer: { name: 'n', email: 'e', taxId: 't', phone: 'p' },
				metadata: {},
			};
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockResolvedValueOnce(gatewayResponse);
			const dispatchSpy = vi.spyOn(queueProducer, 'dispatch');
			const result = await sut.exec(defaultInput);
			expect(result.transaction.status).toBe(EPaymentStatus.Pending);
			expect(dispatchSpy).not.toHaveBeenCalled();
		});
	});

	describe('Transaction History Recording', () => {
		it('should record history when transaction is created', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			const historySpy = vi.spyOn(transactionHistoriesRepository, 'insertOne');
			await sut.exec(defaultInput);
			expect(historySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						fromStatus: 'NONE',
						toStatus: EPaymentStatus.Pending,
						trigger: 'API_CREATE',
					}),
				}),
			);
		});

		it('should record history when transaction fails due to missing credentials', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			vi.spyOn(
				providersCredentialsRepository,
				'findByProjectIdAndProvider',
			).mockResolvedValueOnce(null);
			const historySpy = vi.spyOn(transactionHistoriesRepository, 'insertOne');
			await expect(sut.exec(defaultInput)).rejects.toThrow();
			// Should be called twice: once for creation, once for failure
			expect(historySpy).toHaveBeenCalledTimes(2);
			expect(historySpy).toHaveBeenLastCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						fromStatus: EPaymentStatus.Pending,
						toStatus: EPaymentStatus.Failed,
						trigger: 'API_CREATE',
						metadata: expect.objectContaining({
							error: 'Provider credentials not found',
						}),
					}),
				}),
			);
		});

		it('should record history when gateway fails', async () => {
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(null);
			vi.spyOn(
				paymentsOrchestratorService,
				'processPayment',
			).mockRejectedValueOnce(new Error('Gateway timeout'));
			const historySpy = vi.spyOn(transactionHistoriesRepository, 'insertOne');
			await expect(sut.exec(defaultInput)).rejects.toThrow();
			// Should be called twice: once for creation, once for failure
			expect(historySpy).toHaveBeenCalledTimes(2);
			expect(historySpy).toHaveBeenLastCalledWith(
				expect.objectContaining({
					props: expect.objectContaining({
						fromStatus: EPaymentStatus.Pending,
						toStatus: EPaymentStatus.Failed,
						trigger: 'API_CREATE',
						metadata: expect.objectContaining({
							error: 'Gateway timeout',
						}),
					}),
				}),
			);
		});

		it('should NOT record history when returning existing PAID transaction', async () => {
			const paidTransaction = new TransactionEntityBuilder()
				.withStatus(EPaymentStatus.Paid)
				.build();
			vi.spyOn(projectsRepository, 'findById').mockResolvedValueOnce(
				defaultProject,
			);
			vi.spyOn(
				transactionsRepository,
				'findByIdempotencyKey',
			).mockResolvedValueOnce(paidTransaction);
			const historySpy = vi.spyOn(transactionHistoriesRepository, 'insertOne');
			await sut.exec(defaultInput);
			expect(historySpy).not.toHaveBeenCalled();
		});
	});
});
