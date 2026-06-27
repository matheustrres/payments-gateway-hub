import { TransactionHistoryEntityBuilder } from '../../../../../data/builders/entities/transaction-history.entity.builder';

import { EntityCuid } from '@/core/domain/entities/entity-cuid';
import { EntityId } from '@/core/domain/entities/entity-id';

import { TransactionHistoryEntity } from '@/modules/payments/domain/entities/transaction-history.entity';

describe(TransactionHistoryEntity.name, () => {
	describe('.createNew', () => {
		it('should create a new transaction history entity', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.id).toBeInstanceOf(EntityCuid);
			expect(history.transactionId).toBeInstanceOf(EntityId);
			expect(history.fromStatus).toBe('pending');
			expect(history.toStatus).toBe('paid');
		});

		it('should create a transaction history with all required properties', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.transactionId.toString()).toBe(
				'cl9v1x5f20000qzrmn5g6z5v3',
			);
			expect(history.fromStatus).toBe('pending');
			expect(history.toStatus).toBe('paid');
			expect(history.rawStatus).toBe('PAID');
			expect(history.trigger).toBe('webhook');
			expect(history.triggerId).toBe('webhook-event-123');
			expect(history.metadata).toEqual({
				provider: 'asaas',
				externalId: 'ext-123',
			});
		});

		it('should create a transaction history without optional rawStatus', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withRawStatus(null)
				.build();
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.rawStatus).toBeNull();
		});

		it('should create a transaction history without optional triggerId', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTriggerId(null)
				.build();
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.triggerId).toBeNull();
		});

		it('should create a transaction history without optional metadata', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withMetadata(null)
				.build();
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.metadata).toBeNull();
		});

		it('should create a transaction history with all optional fields as null', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withRawStatus(null)
				.withTriggerId(null)
				.withMetadata(null)
				.build();
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.rawStatus).toBeNull();
			expect(history.triggerId).toBeNull();
			expect(history.metadata).toBeNull();
		});
	});

	describe('.createFrom', () => {
		it('should create a transaction history entity from existing data', () => {
			const history = TransactionHistoryEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionHistoryEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
				},
			);
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(history.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});

		it('should create a transaction history entity with default createdAt', () => {
			const history = TransactionHistoryEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionHistoryEntityBuilder().buildProps(),
				{},
			);
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.id.toString()).toBe('cl9v1x5f20000qzrmn5g6z5v3');
			expect(history.createdAt).toBeInstanceOf(Date);
		});

		it('should create a transaction history with null optional fields', () => {
			const history = TransactionHistoryEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionHistoryEntityBuilder()
					.withRawStatus(null)
					.withTriggerId(null)
					.withMetadata(null)
					.buildProps(),
				{},
			);
			expect(history).toBeInstanceOf(TransactionHistoryEntity);
			expect(history.rawStatus).toBeNull();
			expect(history.triggerId).toBeNull();
			expect(history.metadata).toBeNull();
		});
	});

	describe('getters', () => {
		it('should return transactionId through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.transactionId).toBeInstanceOf(EntityId);
			expect(history.transactionId.toString()).toBe(
				'cl9v1x5f20000qzrmn5g6z5v3',
			);
		});

		it('should return fromStatus through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.fromStatus).toBe('pending');
		});

		it('should return toStatus through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.toStatus).toBe('paid');
		});

		it('should return rawStatus through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.rawStatus).toBe('PAID');
		});

		it('should return null rawStatus when not provided', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withRawStatus(null)
				.build();
			expect(history.rawStatus).toBeNull();
		});

		it('should return trigger through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.trigger).toBe('webhook');
		});

		it('should return triggerId through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.triggerId).toBe('webhook-event-123');
		});

		it('should return null triggerId when not provided', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTriggerId(null)
				.build();
			expect(history.triggerId).toBeNull();
		});

		it('should return metadata through getter', () => {
			const history = new TransactionHistoryEntityBuilder().build();
			expect(history.metadata).toEqual({
				provider: 'asaas',
				externalId: 'ext-123',
			});
		});

		it('should return null metadata when not provided', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withMetadata(null)
				.build();
			expect(history.metadata).toBeNull();
		});
	});

	describe('.toSummary', () => {
		it('should return transaction history summary with all properties', () => {
			const history = TransactionHistoryEntity.createFrom(
				'cl9v1x5f20000qzrmn5g6z5v3',
				new TransactionHistoryEntityBuilder().buildProps(),
				{
					createdAt: new Date('2024-01-01T00:00:00Z'),
					updatedAt: new Date('2024-02-01T00:00:00Z'),
				},
			);
			const summary = history.toSummary();
			expect(summary).toEqual({
				id: 'cl9v1x5f20000qzrmn5g6z5v3',
				transactionId: 'cl9v1x5f20000qzrmn5g6z5v3',
				fromStatus: 'pending',
				toStatus: 'paid',
				rawStatus: 'PAID',
				trigger: 'webhook',
				triggerId: 'webhook-event-123',
				metadata: JSON.stringify({
					provider: 'asaas',
					externalId: 'ext-123',
				}),
				createdAt: new Date('2024-01-01T00:00:00Z'),
			});
		});

		it('should stringify metadata in summary', () => {
			const metadata = {
				provider: 'asaas',
				externalId: 'ext-123',
				additionalData: { key: 'value' },
			};
			const history = new TransactionHistoryEntityBuilder()
				.withMetadata(metadata)
				.build();

			const summary = history.toSummary();
			expect(summary.metadata).toBe(JSON.stringify(metadata));
			expect(typeof summary.metadata).toBe('string');
		});

		it('should include null metadata in summary when not present', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withMetadata(null)
				.build();
			const summary = history.toSummary();
			expect(summary.metadata).toBeNull();
		});

		it('should include null rawStatus in summary when not present', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withRawStatus(null)
				.build();
			const summary = history.toSummary();
			expect(summary.rawStatus).toBeNull();
		});

		it('should include null triggerId in summary when not present', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTriggerId(null)
				.build();
			const summary = history.toSummary();
			expect(summary.triggerId).toBeNull();
		});

		it('should include all null optional fields in summary', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withRawStatus(null)
				.withTriggerId(null)
				.withMetadata(null)
				.build();
			const summary = history.toSummary();
			expect(summary.rawStatus).toBeNull();
			expect(summary.triggerId).toBeNull();
			expect(summary.metadata).toBeNull();
		});
	});

	describe('different status transition scenarios', () => {
		it('should create history for pending to failed transition', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withFromStatus('pending')
				.withToStatus('failed')
				.build();
			expect(history.fromStatus).toBe('pending');
			expect(history.toStatus).toBe('failed');
		});

		it('should create history for pending to cancelled transition', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withFromStatus('pending')
				.withToStatus('cancelled')
				.build();
			expect(history.fromStatus).toBe('pending');
			expect(history.toStatus).toBe('cancelled');
		});

		it('should create history for paid to refunded transition', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withFromStatus('paid')
				.withToStatus('refunded')
				.build();
			expect(history.fromStatus).toBe('paid');
			expect(history.toStatus).toBe('refunded');
		});
	});

	describe('different trigger scenarios', () => {
		it('should create history with manual trigger', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTrigger('manual')
				.withTriggerId(null)
				.build();
			expect(history.trigger).toBe('manual');
			expect(history.triggerId).toBeNull();
		});

		it('should create history with api trigger', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTrigger('api')
				.withTriggerId('api-request-456')
				.build();
			expect(history.trigger).toBe('api');
			expect(history.triggerId).toBe('api-request-456');
		});

		it('should create history with system trigger', () => {
			const history = new TransactionHistoryEntityBuilder()
				.withTrigger('system')
				.withTriggerId('cron-job-789')
				.build();
			expect(history.trigger).toBe('system');
			expect(history.triggerId).toBe('cron-job-789');
		});
	});
});
