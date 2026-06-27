import { MoneyVo } from '@/core/domain/entities/value-objects/money';
import {
	ECurrency,
	EPaymentMethod,
	EPaymentProvider,
	EPaymentStatus,
} from '@/core/enums/payment';
import { PaymentMetadata } from '@/core/types';

import { ProjectEntity } from '@/modules/backoffice/domain/entities/project.entity';
import {
	TransactionEntity,
	TransactionEntityProps,
} from '@/modules/payments/domain/entities/transaction.entity';

export class TransactionEntityBuilder {
	#props: TransactionEntityProps = {
		idempotencyKey: 'idempotency-key-123',
		externalId: 'external-id-456',
		externalStatus: 'pending',
		amountInCents: MoneyVo.fromCents(10000n, ECurrency.BRL),
		currency: ECurrency.BRL,
		paymentMethod: EPaymentMethod.Pix,
		provider: EPaymentProvider.Asaas,
		status: EPaymentStatus.Pending,
		customerEmail: 'customer@example.com',
		customerTaxId: '12345678901',
		paymentData: { additionalInfo: 'test' },
		project: ProjectEntity.createNew({
			testApiKeyHash: 'test_hashed_key',
			testApiKeyPrefix: 'sk_test_',
			liveApiKeyHash: 'live_hashed_key',
			liveApiKeyPrefix: 'sk_live_',
			isActive: true,
			name: 'Test Project',
			webhookUrl: 'https://example.com/webhook',
		}),
		paymentUrl: 'https://example.com/payment',
	};

	constructor(props?: Partial<TransactionEntityProps>) {
		if (props) {
			this.#props = { ...this.#props, ...props };
		}
	}

	withIdempotencyKey(idempotencyKey: string): this {
		this.#props.idempotencyKey = idempotencyKey;
		return this;
	}

	withExternalId(externalId: string): this {
		this.#props.externalId = externalId;
		return this;
	}

	withExternalStatus(externalStatus: string): this {
		this.#props.externalStatus = externalStatus;
		return this;
	}

	withAmountInCents(amountInCents: MoneyVo): this {
		this.#props.amountInCents = amountInCents;
		return this;
	}

	withCurrency(currency: ECurrency): this {
		this.#props.currency = currency;
		return this;
	}

	withPaymentMethod(paymentMethod: EPaymentMethod): this {
		this.#props.paymentMethod = paymentMethod;
		return this;
	}

	withProvider(provider: EPaymentProvider): this {
		this.#props.provider = provider;
		return this;
	}

	withStatus(status: EPaymentStatus): this {
		this.#props.status = status;
		return this;
	}

	withCustomerEmail(customerEmail: string): this {
		this.#props.customerEmail = customerEmail;
		return this;
	}

	withCustomerTaxId(customerTaxId: string): this {
		this.#props.customerTaxId = customerTaxId;
		return this;
	}

	withPaymentData(paymentData: PaymentMetadata): this {
		this.#props.paymentData = paymentData;
		return this;
	}

	withProject(project: ProjectEntity): this {
		this.#props.project = project;
		return this;
	}

	withPaymentUrl(paymentUrl: string): this {
		this.#props.paymentUrl = paymentUrl;
		return this;
	}

	build(): TransactionEntity {
		return TransactionEntity.createOne(this.#props);
	}

	buildProps(): TransactionEntityProps {
		return { ...this.#props };
	}
}
