import { ApiKeyHelper } from '@/core/domain/helpers/api-key.helper';

describe(ApiKeyHelper.name, () => {
	describe('.isProduction', () => {
		it('should return true for live API keys', () => {
			const liveKey = 'sk_live_abcd1234567890abcdef';
			expect(ApiKeyHelper.isProduction(liveKey)).toBe(true);
		});

		it('should return false for test API keys', () => {
			const testKey = 'sk_test_abcd1234567890abcdef';
			expect(ApiKeyHelper.isProduction(testKey)).toBe(false);
		});

		it('should throw error for invalid API key format', () => {
			const invalidKey = 'invalid_key_format';
			expect(() => ApiKeyHelper.isProduction(invalidKey)).toThrow(
				'Invalid API key format',
			);
		});
	});

	describe('.getEnvironment', () => {
		it('should return "live" for live API keys', () => {
			const liveKey = 'sk_live_abcd1234567890abcdef';
			expect(ApiKeyHelper.getEnvironment(liveKey)).toBe('live');
		});

		it('should return "test" for test API keys', () => {
			const testKey = 'sk_test_abcd1234567890abcdef';
			expect(ApiKeyHelper.getEnvironment(testKey)).toBe('test');
		});

		it('should throw error for invalid API key format', () => {
			const invalidKey = 'invalid_key_format';
			expect(() => ApiKeyHelper.getEnvironment(invalidKey)).toThrow(
				'Invalid API key format',
			);
		});
	});
});
