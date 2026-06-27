import { Admin, AdminAudit } from '@prisma/client';

import { AdminAuditEntity } from '@/modules/backoffice/domain/entities/admin-audit';
import { AdminEntity } from '@/modules/backoffice/domain/entities/admin.entity';
import { PasswordVo } from '@/modules/backoffice/domain/entities/value-objects/password.vo';
import {
	AdminAuditAction,
	AdminAuditResource,
} from '@/modules/backoffice/domain/types/admin-audit';

export class AdminAuditMapper {
	static toDomain(raw: AdminAudit, rawAdmin: Admin): AdminAuditEntity {
		return AdminAuditEntity.createFrom(raw.id, {
			action: raw.action as AdminAuditAction,
			resource: raw.resource as AdminAuditResource,
			resourceId: raw.resourceId,
			admin: AdminEntity.createFrom(
				rawAdmin.id,
				{
					name: rawAdmin.name,
					email: rawAdmin.email,
					password: PasswordVo.create(rawAdmin.password, true),
				},
				{
					createdAt: rawAdmin.createdAt,
				},
			),
			ipAddress: raw.ipAddress,
			oldData: raw.oldData as any,
			newData: raw.newData as any,
		});
	}

	static toPersistence(entity: AdminAuditEntity): AdminAudit {
		return {
			...entity.toSummary(),
			oldData: JSON.stringify(entity.oldData),
			newData: JSON.stringify(entity.newData),
		};
	}
}
