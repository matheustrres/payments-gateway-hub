import { Admin } from '@prisma/client';

import { AdminEntity } from '@/modules/backoffice/domain/entities/admin.entity';
import { PasswordVo } from '@/modules/backoffice/domain/entities/value-objects/password.vo';

export class AdminMapper {
	static toDomain(raw: Admin): AdminEntity {
		return AdminEntity.createFrom(
			raw.id,
			{
				name: raw.name,
				email: raw.email,
				password: PasswordVo.create(raw.password, true),
			},
			{
				createdAt: raw.createdAt,
			},
		);
	}

	static toPersistence(entity: AdminEntity): Admin {
		return {
			id: entity.id.toString(),
			name: entity.name,
			email: entity.email,
			password: entity.password.toString(),
			createdAt: entity.createdAt,
		};
	}
}
