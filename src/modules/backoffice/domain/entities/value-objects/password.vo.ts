import { compare, genSalt, hash } from '@node-rs/bcrypt';

import { StringValueObject } from '@/core/domain/entities/value-objects/primitivites/string';

export class PasswordVo extends StringValueObject {
	private constructor(value: string) {
		super(value);
	}

	static create(hash: string, isHashed: true): PasswordVo;
	static create(plain: string, isHashed?: false): Promise<PasswordVo>;
	static create(
		value: string,
		isHashed = false,
	): PasswordVo | Promise<PasswordVo> {
		return isHashed
			? new PasswordVo(value)
			: PasswordVo.#hash(value).then((h) => new PasswordVo(h));
	}

	async compare(plain: string): Promise<boolean> {
		return compare(plain, this.value);
	}

	static async #hash(plain: string): Promise<string> {
		const salt = await genSalt(9);
		return await hash(plain, undefined, salt);
	}
}
