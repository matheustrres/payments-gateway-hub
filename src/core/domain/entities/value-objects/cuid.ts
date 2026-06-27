import cuid2 from '@paralleldrive/cuid2';

import { StringValueObject } from './primitivites/string';

export class Cuid extends StringValueObject {
	private constructor(value: string) {
		super(value);
	}

	static create(value?: string): Cuid {
		return new Cuid(value ?? cuid2.createId());
	}
}
