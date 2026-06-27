import { Id } from '@/core/domain/entities/id';
import { DomainException } from '@/core/domain/exceptions/domain-exception';

export class EntityId implements Id<EntityId> {
	constructor(private readonly identifier: string | number) {
		this.validate();
	}

	equals(id: EntityId): boolean {
		return this.identifier === id.toString();
	}

	toString(): string {
		return this.identifier.toString();
	}

	protected validate(): void {
		if (this.#identifierIsEmpty()) {
			throw new DomainException('Aggregate Id should not be empty');
		}
	}

	#identifierIsEmpty(): boolean {
		if (typeof this.identifier === 'string') {
			return this.identifier.trim().length <= 0;
		}

		return this.identifier <= 0;
	}
}
