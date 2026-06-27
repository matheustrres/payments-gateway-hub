export class Guard {
	static isEmpty(value: unknown): value is undefined | null {
		if (Guard.#isNullOrUndefined(value)) return true;
		if (Guard.#isString(value) || this.#isArray(value)) {
			return value.length === 0;
		}
		if (Guard.#isObject(value)) {
			return Object.keys(value).length === 0;
		}
		return false;
	}

	static #isNullOrUndefined(value: unknown): value is undefined | null {
		return value === null || value === undefined;
	}

	static #isString(value: unknown): value is string {
		return typeof value === 'string';
	}

	static #isArray(value: unknown): value is unknown[] {
		return Array.isArray(value);
	}

	static #isObject(value: unknown): value is object {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
}
