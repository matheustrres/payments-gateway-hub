import { AdminEntity } from '../entities/admin.entity';

import { IRepository } from '@/core/domain/repository';

export abstract class IAdminsRepository extends IRepository<AdminEntity> {
	abstract findByEmail(email: string): Promise<AdminEntity | null>;
}
