import { AdminAuditEntity } from '../entities/admin-audit';
import { AdminAuditResource } from '../types/admin-audit';

export type FindManyPaginatedParams = {
	adminId?: string;
	resource?: AdminAuditResource;
	resourceId?: string;
	page: number;
	limit: number;
};

export abstract class IAdminAuditsRepository {
	abstract findManyPaginated(
		params: FindManyPaginatedParams,
	): Promise<{ items: AdminAuditEntity[]; total: number }>;
}
