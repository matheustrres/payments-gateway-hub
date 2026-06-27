import { EntityId } from './entity-id';

import { DomainException } from '../exceptions/domain-exception';
import { Guard } from '../logic/guard';

export type EntityMeta = {
	createdAt?: Date;
	updatedAt?: Date | null;
	deletedAt?: Date | null;
};
export type CreateEntityProps<T> = {
	id: EntityId;
	props: T;
	meta?: EntityMeta;
};

export abstract class Entity<EntityProps> {
	readonly id: EntityId;
	protected props!: EntityProps;
	readonly createdAt: Date;

	constructor({ id, props, meta }: CreateEntityProps<EntityProps>) {
		if (Guard.isEmpty(props)) {
			throw new DomainException('Entity props cannot be empty');
		}
		this.id = id;
		this.props = props;
		this.createdAt = meta?.createdAt ?? new Date();
	}

	protected getProps(): EntityProps {
		return { ...this.props };
	}
}

export abstract class UpdatableEntity<EntityProps> extends Entity<EntityProps> {
	#updatedAt: Date | null;

	constructor({ id, props, meta }: CreateEntityProps<EntityProps>) {
		super({ id, props, meta });
		this.#updatedAt = meta?.updatedAt ?? null;
	}

	get updatedAt(): Date | null {
		return this.#updatedAt;
	}

	protected touch(): void {
		this.#updatedAt = new Date();
	}
}

export abstract class DeletableEntity<
	EntityProps,
> extends UpdatableEntity<EntityProps> {
	#deletedAt: Date | null;

	constructor({ id, props, meta }: CreateEntityProps<EntityProps>) {
		super({ id, props, meta });
		this.#deletedAt = meta?.deletedAt ?? null;
	}

	get deletedAt(): Date | null {
		return this.#deletedAt;
	}

	protected touch(): void {
		super.touch();
	}

	protected softDelete(): void {
		if (this.isDeleted()) return;
		this.#deletedAt = new Date();
		this.touch();
	}

	isDeleted(): boolean {
		return !!this.#deletedAt;
	}
}
