import { AdminEntity } from './admin.entity';

import { AdminAuditAction, AdminAuditResource } from '../types/admin-audit';

import {
	CreateEntityProps,
	Entity,
	EntityMeta,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';

export class AdminAuditEntity extends Entity<AdminAuditProps> {
	private constructor(props: AdminAuditConstructorProps) {
		super(props);
	}

	static createNew(props: AdminAuditProps): AdminAuditEntity {
		return new AdminAuditEntity({
			id: EntityCuid.create(),
			props,
		});
	}

	static createFrom(
		id: string,
		props: AdminAuditProps,
		meta?: EntityMeta,
	): AdminAuditEntity {
		return new AdminAuditEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get admin(): AdminEntity {
		return this.props.admin;
	}

	get action(): AdminAuditAction {
		return this.props.action;
	}

	get resource(): AdminAuditResource {
		return this.props.resource;
	}

	get resourceId(): string {
		return this.props.resourceId;
	}

	get oldData(): Record<string, unknown> | undefined {
		return this.props.oldData;
	}

	get newData(): Record<string, unknown> | undefined {
		return this.props.newData;
	}

	get ipAddress(): string {
		return this.props.ipAddress;
	}

	toSummary(): AdminAuditSummary {
		return {
			id: this.id.toString(),
			adminId: this.admin.id.toString(),
			action: this.action,
			resource: this.resource,
			resourceId: this.resourceId,
			oldData: this.oldData || {},
			newData: this.newData || {},
			ipAddress: this.ipAddress,
			createdAt: this.createdAt,
		};
	}
}

type AdminAuditConstructorProps = CreateEntityProps<AdminAuditProps>;
type AdminAuditSummary = {
	id: string;
	adminId: string;
	action: AdminAuditAction;
	resource: AdminAuditResource;
	resourceId: string;
	oldData: Record<string, unknown>;
	newData: Record<string, unknown>;
	ipAddress: string;
	createdAt: Date;
};
export type AdminAuditProps = {
	admin: AdminEntity;
	action: AdminAuditAction;
	resource: AdminAuditResource;
	resourceId: string;
	oldData?: Record<string, unknown>;
	newData?: Record<string, unknown>;
	ipAddress: string;
};
