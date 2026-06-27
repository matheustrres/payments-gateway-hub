import { SetMetadata } from '@nestjs/common';

import {
	AdminAuditAction,
	AdminAuditResource,
} from '@/modules/backoffice/domain/types/admin-audit';

export type AdminAuditOptions = {
	action: AdminAuditAction;
	resource: AdminAuditResource;
};

export const ADMIN_AUDIT_METADATA_KEY = 'admin_audit_metadata';
export const AdminAudit = (options: AdminAuditOptions) =>
	SetMetadata(ADMIN_AUDIT_METADATA_KEY, options);
