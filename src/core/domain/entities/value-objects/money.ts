import { DomainException } from '@/core/domain/exceptions/domain-exception';
import { ECurrency } from '@/core/enums/payment';

import { errorMessages } from '@/shared/utils/err-messages';

export class MoneyVo {
	private readonly _cents: bigint;
	private readonly _currency: ECurrency;

	private constructor(cents: bigint, currency: ECurrency) {
		this._cents = cents;
		this._currency = currency;
		this.validate();
	}

	static fromCents(cents: number | bigint, currency: ECurrency): MoneyVo {
		const centsValue =
			typeof cents === 'number' ? BigInt(Math.trunc(cents)) : cents;
		return new MoneyVo(centsValue, currency);
	}

	static create(amount: number | bigint, currency: ECurrency): MoneyVo {
		const cents =
			typeof amount === 'number' ? BigInt(Math.trunc(amount)) : amount;
		return new MoneyVo(cents, currency);
	}

	static fromFloat(amount: number, currency: ECurrency): MoneyVo {
		const cents = BigInt(Math.round(amount * 100));
		return new MoneyVo(cents, currency);
	}

	private validate(): void {
		if (this._cents < 0n) {
			throw new DomainException(errorMessages.money.invalidCentsAmount);
		}
	}

	get value(): bigint {
		return this._cents;
	}

	get currency(): ECurrency {
		return this._currency;
	}

	toFloat(): number {
		const value = Number(this._cents);
		if (!Number.isSafeInteger(value)) {
			throw new DomainException(
				errorMessages.money.valueTooLargeForSafeConversion,
			);
		}
		return value / 100;
	}

	add(other: MoneyVo): MoneyVo {
		this.ensureSameCurrency(other);
		return MoneyVo.create(this._cents + other.value, this._currency);
	}

	subtract(other: MoneyVo): MoneyVo {
		this.ensureSameCurrency(other);
		const result = this._cents - other.value;
		if (result < 0n) {
			throw new DomainException(errorMessages.money.invalidSubtractionResult);
		}
		return MoneyVo.create(result, this._currency);
	}

	equals(other: MoneyVo): boolean {
		return this._cents === other.value && this._currency === other.currency;
	}

	multiply(factor: number): MoneyVo {
		if (factor < 0) {
			throw new DomainException(
				errorMessages.money.invalidMultiplicationFactor,
			);
		}
		const result = BigInt(Math.round(Number(this._cents) * factor));
		return MoneyVo.fromCents(result, this._currency);
	}

	divide(divisor: number): MoneyVo {
		if (divisor <= 0) {
			throw new DomainException(errorMessages.money.invalidDivisionDivisor);
		}
		const result = BigInt(Math.round(Number(this._cents) / divisor));
		return MoneyVo.fromCents(result, this._currency);
	}

	isGreaterThan(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this._cents > other.value;
	}

	isLessThan(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this._cents < other.value;
	}

	isGreaterThanOrEqual(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this._cents >= other.value;
	}

	isLessThanOrEqual(other: MoneyVo): boolean {
		this.ensureSameCurrency(other);
		return this._cents <= other.value;
	}

	isZero(): boolean {
		return this._cents === 0n;
	}

	isPositive(): boolean {
		return this._cents > 0n;
	}

	toString(): string {
		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: this._currency,
		}).format(this.toFloat());
	}

	toJSON() {
		return {
			value: Number(this._cents),
			currency: this._currency,
			formatted: this.toString(),
		};
	}

	private ensureSameCurrency(other: MoneyVo): void {
		if (this._currency !== other.currency) {
			throw new DomainException(
				errorMessages.money.invalidCurrencyOperation(
					this._currency,
					other.currency,
				),
			);
		}
	}
}
