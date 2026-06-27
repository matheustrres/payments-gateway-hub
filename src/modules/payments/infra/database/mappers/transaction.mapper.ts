import { Project, Transaction } from '@prisma/client';

import { MoneyVo } from '@/core/domain/entities/value-objects/money';
import {
	ECurrency,
	EPaymentMethod,
	EPaymentProvider,
	EPaymentStatus,
} from '@/core/enums/payment';

import { ProjectMapper } from '@/modules/backoffice/infra/database/mappers/project.mapper';
import { TransactionEntity } from '@/modules/payments/domain/entities/transaction.entity';

export class TransactionMapper {
	static toDomain(raw: Transaction, rawProject: Project): TransactionEntity {
		return TransactionEntity.createFrom(raw.id, {
			...raw,
			amountInCents: MoneyVo.create(
				raw.amountInCents,
				raw.currency as ECurrency,
			),
			currency: raw.currency as ECurrency,
			project: ProjectMapper.toDomain(rawProject),
			paymentMethod: raw.paymentMethod as EPaymentMethod,
			provider: raw.provider as EPaymentProvider,
			status: raw.status as EPaymentStatus,
			paymentUrl: raw.paymentUrl,
			...(raw.paymentData && {
				paymentData: JSON.parse(raw.paymentData.toString()),
			}),
		});
	}

	static toPersistence(entity: TransactionEntity): Transaction {
		return {
			...entity.toSummary(),
			projectId: entity.project.id.toString(),
			amountInCents: entity.amountInCents.value,
			paymentData: JSON.stringify(entity.paymentData),
		};
	}
}
