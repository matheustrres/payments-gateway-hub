import { TransactionEntityBuilder } from '../../../../../data/builders/entities/transaction.entity.builder';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { MoneyVo } from '@/core/domain/entities/value-objects/money';
import {
	ECurrency,
	EPaymentMethod,
	EPaymentProvider,
	EPaymentStatus,
} from '@/core/enums/payment';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';

describe(TransactionEntity.name, () => {
	describe('.createOne', () => {
		it('should create a new transaction entity', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction).toBeInstanceOf(TransactionEntity);
			expect(transaction.id).toBeInstanceOf(EntityCuid);
			expect(transaction.idempotencyKey).toBe('idempotency-key-123');
			expect(transaction.externalId).toBe('external-id-456');
			expect(transaction.status).toBe(EPaymentStatus.Pending);
		});

		it('should create a transaction with all required properties', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.amountInCents).toBeInstanceOf(MoneyVo);
			expect(transaction.amountInCents.value).toBe(10000n);
			expect(transaction.currency).toBe(ECurrency.BRL);
			expect(transaction.paymentMethod).toBe(EPaymentMethod.Pix);
			expect(transaction.provider).toBe(EPaymentProvider.Asaas);
			expect(transaction.customerEmail).toBe('customer@example.com');
			expect(transaction.customerTaxId).toBe('12345678901');
			expect(transaction.project).toBeInstanceOf(ProjectEntity);
		});

		it('should create a transaction without optional paymentData', () => {
			const transaction = new TransactionEntityBuilder()
				.withPaymentData(null)
				.build();
			expect(transaction).toBeInstanceOf(TransactionEntity);
			expect(transaction.paymentData).toBeNull();
		});
	});

	describe('.createFrom', () => {
		it('should create a transaction entity from existing data', () => {
			const transaction = TransactionEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			expect(transaction).toBeInstanceOf(TransactionEntity);
			expect(transaction.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(transaction.createdAt.toISOString()).toBe(
				'2024-01-01T00:00:00.000Z',
			);
			expect(transaction.updatedAt?.toISOString()).toBe(
				'2024-02-01T00:00:00.000Z',
			);
		});

		it('should create a transaction entity without meta', () => {
			const transaction = TransactionEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionEntityBuilder().buildProps(),
			);
			expect(transaction).toBeInstanceOf(TransactionEntity);
			expect(transaction.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(transaction.createdAt).toBeInstanceOf(Date);
			expect(transaction.updatedAt).toBeNull();
		});
	});

	describe('getters', () => {
		it('should return idempotencyKey through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.idempotencyKey).toBe('idempotency-key-123');
		});
		it('should return externalId through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.externalId).toBe('external-id-456');
		});

		it('should return externalStatus through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.externalStatus).toBe('pending');
		});

		it('should return amountInCents through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.amountInCents).toBeInstanceOf(MoneyVo);
			expect(transaction.amountInCents.value).toBe(10000n);
		});

		it('should return currency through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.currency).toBe(ECurrency.BRL);
		});

		it('should return paymentMethod through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.paymentMethod).toBe(EPaymentMethod.Pix);
		});

		it('should return provider through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.provider).toBe(EPaymentProvider.Asaas);
		});

		it('should return status through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.status).toBe(EPaymentStatus.Pending);
		});

		it('should return customerEmail through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.customerEmail).toBe('customer@example.com');
		});

		it('should return customerTaxId through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.customerTaxId).toBe('12345678901');
		});

		it('should return paymentData through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.paymentData).toEqual({ additionalInfo: 'test' });
		});

		it('should return project through getter', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.project).toBeInstanceOf(ProjectEntity);
		});
	});

	describe('.setStatus', () => {
		it('should update transaction status', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.status).toBe(EPaymentStatus.Pending);
			expect(transaction.updatedAt).toBeNull();
			transaction.setStatus(EPaymentStatus.Paid);
			expect(transaction.status).toBe(EPaymentStatus.Paid);
			expect(transaction.updatedAt).not.toBeNull();
		});

		it('should update updatedAt timestamp when status changes', () => {
			const transaction = new TransactionEntityBuilder().build();
			const initialUpdatedAt = transaction.updatedAt;
			transaction.setStatus(EPaymentStatus.Paid);
			expect(transaction.updatedAt).not.toBe(initialUpdatedAt);
			expect(transaction.updatedAt).toBeInstanceOf(Date);
		});

		it('should handle status change to Failed', () => {
			const transaction = new TransactionEntityBuilder().build();
			transaction.setStatus(EPaymentStatus.Failed);
			expect(transaction.status).toBe(EPaymentStatus.Failed);
		});

		it('should handle status change to Cancelled', () => {
			const transaction = new TransactionEntityBuilder().build();
			transaction.setStatus(EPaymentStatus.Cancelled);
			expect(transaction.status).toBe(EPaymentStatus.Cancelled);
		});

		it('should handle status change to Refunded', () => {
			const transaction = new TransactionEntityBuilder().build();
			transaction.setStatus(EPaymentStatus.Refunded);
			expect(transaction.status).toBe(EPaymentStatus.Refunded);
		});
	});

	describe('.setExternalId', () => {
		it('should update externalId', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.externalId).toBe('external-id-456');
			expect(transaction.updatedAt).toBeNull();
			transaction.setExternalId('new-external-id-789');
			expect(transaction.externalId).toBe('new-external-id-789');
			expect(transaction.updatedAt).not.toBeNull();
		});

		it('should update updatedAt timestamp when externalId changes', () => {
			const transaction = new TransactionEntityBuilder().build();
			const initialUpdatedAt = transaction.updatedAt;
			transaction.setExternalId('updated-external-id');
			expect(transaction.updatedAt).not.toBe(initialUpdatedAt);
			expect(transaction.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe('.setPaymentData', () => {
		it('should update paymentData', () => {
			const transaction = new TransactionEntityBuilder().build();
			expect(transaction.paymentData).toEqual({ additionalInfo: 'test' });
			expect(transaction.updatedAt).toBeNull();
			const newPaymentData = { qrCode: 'qr-code-data', pixKey: 'pix-key' };
			transaction.setPaymentData(newPaymentData);
			// setPaymentData merges data, so expect both old and new
			expect(transaction.paymentData).toEqual({
				additionalInfo: 'test',
				qrCode: 'qr-code-data',
				pixKey: 'pix-key',
			});
			expect(transaction.updatedAt).not.toBeNull();
		});

		it('should update updatedAt timestamp when paymentData changes', () => {
			const transaction = new TransactionEntityBuilder().build();
			const initialUpdatedAt = transaction.updatedAt;
			transaction.setPaymentData({ newField: 'newValue' });
			expect(transaction.updatedAt).not.toBe(initialUpdatedAt);
			expect(transaction.updatedAt).toBeInstanceOf(Date);
		});

		it('should allow setting empty paymentData object', () => {
			const transaction = new TransactionEntityBuilder().build();
			transaction.setPaymentData({});
			// setPaymentData merges, so existing data remains
			expect(transaction.paymentData).toEqual({ additionalInfo: 'test' });
		});
	});

	describe('.toSummary', () => {
		it('should return transaction summary with all properties', () => {
			const transaction = TransactionEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			const summary = transaction.toSummary();
			expect(summary).toEqual({
				id: 'cl9v1x5f20000qzrmn5g6z5v3',
				idempotencyKey: 'idempotency-key-123',
				externalId: 'external-id-456',
				externalStatus: 'pending',
				amountInCents: 100,
				currency: ECurrency.BRL,
				paymentMethod: EPaymentMethod.Pix,
				provider: EPaymentProvider.Asaas,
				status: EPaymentStatus.Pending,
				customerEmail: 'customer@example.com',
				customerTaxId: '12345678901',
				paymentUrl: 'https://example.com/payment',
				paymentData: { additionalInfo: 'test' },
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: new Date('2024-02-01T00:00:00Z'),
			});
		});

		it('should convert amountInCents to float in summary', () => {
			const transaction = new TransactionEntityBuilder().build();
			const summary = transaction.toSummary();
			expect(summary.amountInCents).toBe(100);
			expect(typeof summary.amountInCents).toBe('number');
		});

		it('should include null updatedAt in summary for new transaction', () => {
			const transaction = new TransactionEntityBuilder().build();
			const summary = transaction.toSummary();
			expect(summary.updatedAt).toBeNull();
		});

		it('should include paymentData in summary when present', () => {
			const transaction = new TransactionEntityBuilder().build();
			const summary = transaction.toSummary();
			expect(summary.paymentData).toEqual({ additionalInfo: 'test' });
		});

		it('should include null paymentData in summary when not present', () => {
			const transaction = new TransactionEntityBuilder()
				.withPaymentData(null)
				.build();
			const summary = transaction.toSummary();
			expect(summary.paymentData).toBeNull();
		});
	});

	describe('different payment scenarios', () => {
		it('should create transaction with CreditCard payment method', () => {
			const transaction = new TransactionEntityBuilder()
				.withPaymentMethod(EPaymentMethod.Card)
				.build();
			expect(transaction.paymentMethod).toBe(EPaymentMethod.Card);
		});

		it('should create transaction with Boleto payment method', () => {
			const transaction = new TransactionEntityBuilder()
				.withPaymentMethod(EPaymentMethod.Boleto)
				.build();
			expect(transaction.paymentMethod).toBe(EPaymentMethod.Boleto);
		});

		it('should create transaction with Wire payment method', () => {
			const transaction = new TransactionEntityBuilder()
				.withPaymentMethod(EPaymentMethod.Wire)
				.build();
			expect(transaction.paymentMethod).toBe(EPaymentMethod.Wire);
		});

		it('should create transaction with AbacatePay provider', () => {
			const transaction = new TransactionEntityBuilder()
				.withProvider(EPaymentProvider.AbacatePay)
				.build();
			expect(transaction.provider).toBe(EPaymentProvider.AbacatePay);
		});

		it('should create transaction with Payoneer provider', () => {
			const transaction = new TransactionEntityBuilder()
				.withProvider(EPaymentProvider.Payoneer)
				.build();
			expect(transaction.provider).toBe(EPaymentProvider.Payoneer);
		});

		it('should create transaction with USD currency', () => {
			const transaction = new TransactionEntityBuilder()
				.withCurrency(ECurrency.USD)
				.withAmountInCents(MoneyVo.fromCents(5000n, ECurrency.USD))
				.build();
			expect(transaction.currency).toBe(ECurrency.USD);
			expect(transaction.amountInCents.currency).toBe(ECurrency.USD);
		});

		it('should create transaction with EUR currency', () => {
			const transaction = new TransactionEntityBuilder()
				.withCurrency(ECurrency.EUR)
				.withAmountInCents(MoneyVo.fromCents(7500n, ECurrency.EUR))
				.build();
			expect(transaction.currency).toBe(ECurrency.EUR);
			expect(transaction.amountInCents.currency).toBe(ECurrency.EUR);
		});
	});
});
