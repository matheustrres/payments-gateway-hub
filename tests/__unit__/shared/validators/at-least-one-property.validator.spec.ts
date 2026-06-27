import { describe, expect, it } from 'vitest';

import { AtLeastOnePropertyValidator } from '@/shared/validators/at-least-one-property.validator';

class TestDto {
	prop1?: string;
	prop2?: string;
}

describe(AtLeastOnePropertyValidator.name, () => {
	it('should pass when prop1 is provided', async () => {
		const dto = new TestDto();
		dto.prop1 = 'value';
		const validator = new AtLeastOnePropertyValidator();
		const result = validator.validate(dto.prop1, {
			object: dto,
			constraints: [['prop1', 'prop2']],
		} as any);
		expect(result).toBe(true);
	});

	it('should pass when prop2 is provided', async () => {
		const dto = new TestDto();
		dto.prop2 = 'value';
		const validator = new AtLeastOnePropertyValidator();
		const result = validator.validate(dto.prop2, {
			object: dto,
			constraints: [['prop1', 'prop2']],
		} as any);
		expect(result).toBe(true);
	});

	it('should pass when both props are provided', async () => {
		const dto = new TestDto();
		dto.prop1 = 'value1';
		dto.prop2 = 'value2';
		const validator = new AtLeastOnePropertyValidator();
		const result = validator.validate(dto.prop1, {
			object: dto,
			constraints: [['prop1', 'prop2']],
		} as any);

		expect(result).toBe(true);
	});

	it('should fail when neither prop is provided', async () => {
		const dto = new TestDto();
		const validator = new AtLeastOnePropertyValidator();
		const result = validator.validate(undefined, {
			object: dto,
			constraints: [['prop1', 'prop2']],
		} as any);
		expect(result).toBe(false);
	});

	it('should pass when props are empty strings', async () => {
		const dto = new TestDto();
		dto.prop1 = '';
		dto.prop2 = '';
		const validator = new AtLeastOnePropertyValidator();
		const result = validator.validate(dto.prop1, {
			object: dto,
			constraints: [['prop1', 'prop2']],
		} as any);
		expect(result).toBe(true);
	});
});
