import { ApiKeyGenService } from '@/modules/backoffice/domain/services/api-key-gen.service';

describe(ApiKeyGenService.name, () => {
	describe('.generate', () => {
		it('should generate an API key with correct format for live environment', () => {
			const result = ApiKeyGenService.generate('live');
			expect(result).toMatchObject({
				plainStr: expect.stringMatching(/^sk_live_[a-f0-9]{48}$/), // sk_live_ + 48 hex chars
				hashStr: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 hash
				prefixStr: expect.stringMatching(/^sk_live_.{4}$/), // sk_live_ + 4 chars
			});
		});

		it('should generate an API key with correct format for test environment', () => {
			const result = ApiKeyGenService.generate('test');
			expect(result).toMatchObject({
				plainStr: expect.stringMatching(/^sk_test_[a-f0-9]{48}$/), // sk_test_ + 48 hex chars
				hashStr: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 hash
				prefixStr: expect.stringMatching(/^sk_test_.{4}$/), // sk_test_ + 4 chars
			});
		});
	});
});
