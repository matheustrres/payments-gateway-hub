import { Injectable } from '@nestjs/common';

import { AdminEntity } from '@/modules/backoffice/domain/entities/admin.entity';
import { IAdminsRepository } from '@/modules/backoffice/domain/repositories/admins.repository';
import { AdminMapper } from '@/modules/backoffice/infra/database/mappers/admin.mapper';

import { DatabaseService } from '@/shared/modules/database/database.service';

@Injectable()
export class PgSqlAdminsRepository implements IAdminsRepository {
	constructor(private readonly dbService: DatabaseService) {}

	async deleteOne(id: string): Promise<void> {
		await this.dbService.admin.delete({
			where: { id },
		});
	}

	async findAll(): Promise<AdminEntity[]> {
		const admins = await this.dbService.admin.findMany();
		return admins.map(AdminMapper.toDomain);
	}

	async findByEmail(email: string): Promise<AdminEntity | null> {
		const admin = await this.dbService.admin.findUnique({
			where: { email },
		});
		return admin ? AdminMapper.toDomain(admin) : null;
	}

	async findById(id: string): Promise<AdminEntity | null> {
		const admin = await this.dbService.admin.findUnique({
			where: { id },
		});
		return admin ? AdminMapper.toDomain(admin) : null;
	}

	async insertOne(entity: AdminEntity): Promise<void> {
		const raw = AdminMapper.toPersistence(entity);
		await this.dbService.admin.create({
			data: raw,
		});
	}

	async updateOne(entity: AdminEntity): Promise<void> {
		const raw = AdminMapper.toPersistence(entity);
		await this.dbService.admin.update({
			where: { id: raw.id },
			data: raw,
		});
	}
}
