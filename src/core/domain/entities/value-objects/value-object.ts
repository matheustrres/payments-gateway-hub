import { Guard } from '@/core/domain/logic/guard';

export type Primitives = string | number | boolean;

export interface DomainPrimitive<T extends Primitives | Date> {
	value: T;
}

type ValueObjectProps<T> = T extends Primitives | Date ? DomainPrimitive<T> : T;

export abstract class ValueObject<T> {
	protected readonly props: ValueObjectProps<T>;

	constructor(props: ValueObjectProps<T>) {
		this.#checkIfEmpty(props);
		this.validate(props);
		this.props = props;
	}

	static isValueObject(obj: unknown): obj is ValueObject<unknown> {
		return obj instanceof ValueObject;
	}

	equals(vo?: ValueObject<T>): boolean {
		if (Guard.isEmpty(vo)) {
			return false;
		}

		return JSON.stringify(this) === JSON.stringify(vo);
	}

	unpack(): Readonly<ValueObjectProps<T>> {
		return Object.freeze<ValueObjectProps<T>>(this.props);
	}

	#checkIfEmpty(props: ValueObjectProps<T>): void {
		if (Guard.isEmpty(props)) {
			throw new Error('Value Object Property cannot be empty');
		}
	}

	protected abstract validate(props: ValueObjectProps<T>): void;
}
