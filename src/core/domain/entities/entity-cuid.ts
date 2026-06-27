import { Cuid } from './value-objects/cuid';

import { EntityId } from '@/core/domain/entities/entity-id';

export class EntityCuid extends EntityId {
	constructor(protected readonly cuidValue: Cuid) {
		super(EntityCuid.#unpackId(cuidValue));
	}

	static create(): EntityCuid {
		return new EntityCuid(Cuid.create());
	}

	static createFrom(value: string): EntityCuid {
		return new EntityCuid(Cuid.create(value));
	}

	static #unpackId(cuid: Cuid): string {
		return cuid.toString();
	}

	toId(): Cuid {
		return this.cuidValue;
	}
}
