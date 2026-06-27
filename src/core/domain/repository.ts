import { Entity } from './entities/entity';

export abstract class IRepository<T extends Entity<unknown>> {
	abstract deleteOne(id: string): Promise<void>;
	abstract findAll(): Promise<T[]>;
	abstract findById(id: string): Promise<T | null>;
	abstract insertOne(entity: T): Promise<void>;
	abstract updateOne(entity: T): Promise<void>;
}
