import { PasswordVo } from './value-objects/password.vo';

import {
	CreateEntityProps,
	Entity,
	EntityMeta,
} from '@/core/domain/entities/entity';
import { EntityCuid } from '@/core/domain/entities/entity-cuid';

export class AdminEntity extends Entity<AdminEntityProps> {
	private constructor(props: AdminEntityConstructorProps) {
		super(props);
	}

	static createNew(props: AdminEntityProps): AdminEntity {
		return new AdminEntity({
			id: EntityCuid.create(),
			props,
		});
	}

	static createFrom(
		id: string,
		props: AdminEntityProps,
		meta?: EntityMeta,
	): AdminEntity {
		return new AdminEntity({
			id: EntityCuid.createFrom(id),
			props,
			meta,
		});
	}

	get name(): string {
		return this.props.name;
	}

	get email(): string {
		return this.props.email;
	}

	get password(): PasswordVo {
		return this.props.password;
	}
}

type AdminEntityConstructorProps = CreateEntityProps<AdminEntityProps>;

export type AdminEntityProps = {
	name: string;
	email: string;
	password: PasswordVo;
};
