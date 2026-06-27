import { isCuid } from '@paralleldrive/cuid2';
import {
	registerDecorator,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsCuidConstraint implements ValidatorConstraintInterface {
	validate(id: unknown): boolean {
		return typeof id === 'string' && isCuid(id);
	}

	defaultMessage(): string {
		return 'ID must be a valid CUID.';
	}
}

export function IsCuid(validationOptions?: ValidationOptions) {
	return function (obj: object, propertyName: string): void {
		registerDecorator({
			target: obj.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsCuidConstraint,
		});
	};
}
