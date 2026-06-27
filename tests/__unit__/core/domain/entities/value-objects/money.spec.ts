import { MoneyVo } from '@/core/domain/entities/value-objects/money';
import { DomainException } from '@/core/domain/exceptions/domain-exception';
import { ECurrency } from '@/core/enums/payment';

describe(MoneyVo.name, () => {
	describe('.fromCents', () => {
		it('should create a MoneyVo instance from cents with number', () => {
			const money = MoneyVo.fromCents(1000, ECurrency.BRL);
			expect(money.value).toBe(1000n);
			expect(money.currency).toBe(ECurrency.BRL);
		});

		it('should create a MoneyVo instance from cents with bigint', () => {
			const money = MoneyVo.fromCents(2000n, ECurrency.USD);
			expect(money.value).toBe(2000n);
			expect(money.currency).toBe(ECurrency.USD);
		});

		it('should truncate decimal values when creating with number', () => {
			const money = MoneyVo.fromCents(1599.99, ECurrency.BRL);
			expect(money.value).toBe(1599n);
		});

		it('should throw error when cents is negative', () => {
			expect(() => MoneyVo.fromCents(-100, ECurrency.BRL)).toThrow(
				DomainException,
			);
			expect(() => MoneyVo.fromCents(-100, ECurrency.BRL)).toThrow(
				'O valor em centavos não pode ser negativo.',
			);
		});

		it('should create a MoneyVo with zero value', () => {
			const money = MoneyVo.fromCents(0, ECurrency.EUR);
			expect(money.value).toBe(0n);
			expect(money.currency).toBe(ECurrency.EUR);
		});
	});

	describe('.create', () => {
		it('should create a MoneyVo instance with number amount', () => {
			const money = MoneyVo.create(1000, ECurrency.BRL);
			expect(money.value).toBe(1000n);
			expect(money.currency).toBe(ECurrency.BRL);
		});

		it('should create a MoneyVo instance with bigint amount', () => {
			const money = MoneyVo.create(2000n, ECurrency.USD);
			expect(money.value).toBe(2000n);
			expect(money.currency).toBe(ECurrency.USD);
		});

		it('should truncate decimal values when creating with number', () => {
			const money = MoneyVo.create(1599.99, ECurrency.BRL);
			expect(money.value).toBe(1599n);
		});

		it('should throw error when amount is negative', () => {
			expect(() => MoneyVo.create(-100, ECurrency.BRL)).toThrow(
				DomainException,
			);
			expect(() => MoneyVo.create(-100, ECurrency.BRL)).toThrow(
				'O valor em centavos não pode ser negativo.',
			);
		});

		it('should create a MoneyVo with zero value', () => {
			const money = MoneyVo.create(0, ECurrency.EUR);
			expect(money.value).toBe(0n);
			expect(money.currency).toBe(ECurrency.EUR);
		});
	});

	describe('.fromFloat', () => {
		it('should create MoneyVo from float value representing monetary amount', () => {
			const money = MoneyVo.fromFloat(10.5, ECurrency.BRL);
			expect(money.value).toBe(1050n);
			expect(money.currency).toBe(ECurrency.BRL);
		});

		it('should correctly round float values', () => {
			const money1 = MoneyVo.fromFloat(10.555, ECurrency.BRL);
			const money2 = MoneyVo.fromFloat(10.554, ECurrency.BRL);
			expect(money1.value).toBe(1056n);
			expect(money2.value).toBe(1055n);
		});

		it('should handle integer values', () => {
			const money = MoneyVo.fromFloat(100, ECurrency.USD);
			expect(money.value).toBe(10000n);
		});

		it('should throw error when float results in negative value', () => {
			expect(() => MoneyVo.fromFloat(-10.5, ECurrency.BRL)).toThrow(
				DomainException,
			);
		});
	});

	describe('.toFloat', () => {
		it('should convert cents to float value', () => {
			const money = MoneyVo.fromCents(1050n, ECurrency.BRL);
			expect(money.toFloat()).toBe(10.5);
		});

		it('should return 0 for zero value', () => {
			const money = MoneyVo.fromCents(0, ECurrency.BRL);
			expect(money.toFloat()).toBe(0);
		});

		it('should handle large values', () => {
			const money = MoneyVo.fromCents(999999n, ECurrency.USD);
			expect(money.toFloat()).toBe(9999.99);
		});

		it('should throw error when value is too large for safe conversion', () => {
			const unsafeValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
			const money = MoneyVo.fromCents(unsafeValue, ECurrency.BRL);
			expect(() => money.toFloat()).toThrow(DomainException);
			expect(() => money.toFloat()).toThrow(
				'Valor muito grande para conversão segura para número.',
			);
		});
	});

	describe('.add', () => {
		it('should add two money values with same currency', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const result = money1.add(money2);
			expect(result.value).toBe(1500n);
			expect(result.currency).toBe(ECurrency.BRL);
		});

		it('should throw error when adding different currencies', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.USD);
			expect(() => money1.add(money2)).toThrow(DomainException);
			expect(() => money1.add(money2)).toThrow(
				'Não é possível realizar operações entre moedas diferentes: BRL e USD.',
			);
		});

		it('should add zero value', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.EUR);
			const money2 = MoneyVo.fromCents(0n, ECurrency.EUR);
			const result = money1.add(money2);
			expect(result.value).toBe(1000n);
		});
	});

	describe('.subtract', () => {
		it('should subtract two money values with same currency', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const result = money1.subtract(money2);
			expect(result.value).toBe(500n);
			expect(result.currency).toBe(ECurrency.BRL);
		});

		it('should throw error when subtracting different currencies', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.USD);
			expect(() => money1.subtract(money2)).toThrow(DomainException);
			expect(() => money1.subtract(money2)).toThrow(
				'Não é possível realizar operações entre moedas diferentes: BRL e USD.',
			);
		});

		it('should throw error when result would be negative', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(() => money1.subtract(money2)).toThrow(DomainException);
			expect(() => money1.subtract(money2)).toThrow(
				'O resultado da subtração não pode ser negativo.',
			);
		});

		it('should subtract to zero', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.EUR);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.EUR);
			const result = money1.subtract(money2);
			expect(result.value).toBe(0n);
		});
	});

	describe('.equals', () => {
		it('should return true for equal money values', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.equals(money2)).toBe(true);
		});

		it('should return false for different values', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			expect(money1.equals(money2)).toBe(false);
		});

		it('should return false for different currencies', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.USD);
			expect(money1.equals(money2)).toBe(false);
		});

		it('should return true for zero values with same currency', () => {
			const money1 = MoneyVo.fromCents(0n, ECurrency.EUR);
			const money2 = MoneyVo.fromCents(0n, ECurrency.EUR);
			expect(money1.equals(money2)).toBe(true);
		});
	});

	describe('.toString', () => {
		it('should format BRL currency correctly', () => {
			const money = MoneyVo.fromCents(1050n, ECurrency.BRL);
			const formatted = money.toString();
			expect(formatted).toContain('10,50');
			expect(formatted).toMatch(/R\$/);
		});

		it('should format USD currency correctly', () => {
			const money = MoneyVo.fromCents(1050n, ECurrency.USD);
			const formatted = money.toString();
			expect(formatted).toContain('10,50');
			expect(formatted).toMatch(/US\$|\$/);
		});

		it('should format EUR currency correctly', () => {
			const money = MoneyVo.fromCents(1050n, ECurrency.EUR);
			const formatted = money.toString();
			expect(formatted).toContain('10,50');
			expect(formatted).toMatch(/€/);
		});

		it('should format zero value', () => {
			const money = MoneyVo.fromCents(0n, ECurrency.BRL);
			const formatted = money.toString();
			expect(formatted).toContain('0,00');
		});
	});

	describe('.toJSON', () => {
		it('should return JSON representation of money', () => {
			const money = MoneyVo.fromCents(1050n, ECurrency.BRL);
			const json = money.toJSON();
			expect(json).toHaveProperty('value', 1050);
			expect(json).toHaveProperty('currency', 'BRL');
			expect(json).toHaveProperty('formatted');
			expect(json.formatted).toContain('10,50');
		});

		it('should include all properties in JSON', () => {
			const money = MoneyVo.fromCents(5000n, ECurrency.USD);
			const json = money.toJSON();
			expect(Object.keys(json)).toEqual(['value', 'currency', 'formatted']);
		});

		it('should convert bigint value to number in JSON', () => {
			const money = MoneyVo.fromCents(999999n, ECurrency.EUR);
			const json = money.toJSON();
			expect(typeof json.value).toBe('number');
			expect(json.value).toBe(999999);
		});
	});

	describe('.multiply', () => {
		it('should multiply money value by factor', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const result = money.multiply(2);
			expect(result.value).toBe(2000n);
			expect(result.currency).toBe(ECurrency.BRL);
		});

		it('should multiply by decimal factor with rounding', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const result = money.multiply(1.5);
			expect(result.value).toBe(1500n);
		});

		it('should throw error when factor is negative', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(() => money.multiply(-1)).toThrow(DomainException);
			expect(() => money.multiply(-1)).toThrow(
				'O fator de multiplicação não pode ser negativo.',
			);
		});

		it('should multiply by zero', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const result = money.multiply(0);
			expect(result.value).toBe(0n);
		});
	});

	describe('.divide', () => {
		it('should divide money value by divisor', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const result = money.divide(2);
			expect(result.value).toBe(500n);
			expect(result.currency).toBe(ECurrency.BRL);
		});

		it('should divide with rounding', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const result = money.divide(3);
			expect(result.value).toBe(333n);
		});

		it('should throw error when divisor is zero', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(() => money.divide(0)).toThrow(DomainException);
			expect(() => money.divide(0)).toThrow(
				'O divisor deve ser maior que zero.',
			);
		});

		it('should throw error when divisor is negative', () => {
			const money = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(() => money.divide(-2)).toThrow(DomainException);
			expect(() => money.divide(-2)).toThrow(
				'O divisor deve ser maior que zero.',
			);
		});
	});

	describe('.isGreaterThan', () => {
		it('should return true when value is greater', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			expect(money1.isGreaterThan(money2)).toBe(true);
		});

		it('should return false when value is not greater', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isGreaterThan(money2)).toBe(false);
		});

		it('should throw error when comparing different currencies', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.USD);
			expect(() => money1.isGreaterThan(money2)).toThrow(DomainException);
		});
	});

	describe('.isLessThan', () => {
		it('should return true when value is less', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isLessThan(money2)).toBe(true);
		});

		it('should return false when value is not less', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			expect(money1.isLessThan(money2)).toBe(false);
		});

		it('should throw error when comparing different currencies', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.USD);
			expect(() => money1.isLessThan(money2)).toThrow(DomainException);
		});
	});

	describe('.isGreaterThanOrEqual', () => {
		it('should return true when value is greater', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			expect(money1.isGreaterThanOrEqual(money2)).toBe(true);
		});

		it('should return true when values are equal', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isGreaterThanOrEqual(money2)).toBe(true);
		});

		it('should return false when value is less', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isGreaterThanOrEqual(money2)).toBe(false);
		});
	});

	describe('.isLessThanOrEqual', () => {
		it('should return true when value is less', () => {
			const money1 = MoneyVo.fromCents(500n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isLessThanOrEqual(money2)).toBe(true);
		});

		it('should return true when values are equal', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			expect(money1.isLessThanOrEqual(money2)).toBe(true);
		});

		it('should return false when value is greater', () => {
			const money1 = MoneyVo.fromCents(1000n, ECurrency.BRL);
			const money2 = MoneyVo.fromCents(500n, ECurrency.BRL);
			expect(money1.isLessThanOrEqual(money2)).toBe(false);
		});
	});

	describe('.isZero', () => {
		it('should return true for zero value', () => {
			const money = MoneyVo.fromCents(0n, ECurrency.BRL);
			expect(money.isZero()).toBe(true);
		});

		it('should return false for non-zero value', () => {
			const money = MoneyVo.fromCents(1n, ECurrency.BRL);
			expect(money.isZero()).toBe(false);
		});
	});

	describe('.isPositive', () => {
		it('should return true for positive value', () => {
			const money = MoneyVo.fromCents(100n, ECurrency.BRL);
			expect(money.isPositive()).toBe(true);
		});

		it('should return false for zero value', () => {
			const money = MoneyVo.fromCents(0n, ECurrency.BRL);
			expect(money.isPositive()).toBe(false);
		});
	});

	it('should return value through getter', () => {
		const money = MoneyVo.create(1000n, ECurrency.BRL);
		expect(money.value).toBe(1000n);
	});

	it('should return currency through getter', () => {
		const money = MoneyVo.create(1000n, ECurrency.USD);
		expect(money.currency).toBe(ECurrency.USD);
	});
});
