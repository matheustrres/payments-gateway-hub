import {
	registerDecorator,
	ValidationOptions,
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class AtLeastOnePropertyValidator implements ValidatorConstraintInterface {
	validate(value: any, args: ValidationArguments) {
		const relatedProperties = args.constraints[0];
		const object = args.object as any;
		return (
			!!value ||
			relatedProperties.some((property: string) => {
				return object[property] !== undefined && object[property] !== null;
			})
		);
	}

	defaultMessage(args: ValidationArguments) {
		const relatedProperties = args.constraints[0];
		return `At least one of the following properties must be provided: ${relatedProperties.join(
			', ',
		)} or ${args.property}`;
	}
}

export function AtLeastOneProperty(
	properties: string[],
	validationOptions?: ValidationOptions,
) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'atLeastOneProperty',
			target: object.constructor,
			propertyName: propertyName,
			constraints: [properties],
			options: validationOptions,
			validator: AtLeastOnePropertyValidator,
		});
	};
}
