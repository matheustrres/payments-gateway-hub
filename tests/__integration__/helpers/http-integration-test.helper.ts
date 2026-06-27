import { HttpModule, HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';

import { IHttpRequestingService } from '@/shared/modules/requesting/requesting.interface';

export async function createRealHttpService(): Promise<IHttpRequestingService> {
	const moduleRef: TestingModule = await Test.createTestingModule({
		imports: [HttpModule],
	}).compile();
	const httpService = moduleRef.get<HttpService>(HttpService);
	return httpService;
}

export const IntegrationTestConfig = {
	abacatePay: {
		get apiKey() {
			return (
				process.env['ABACATEPAY_API_KEY'] || 'abc_dev_DuT3q1eD3Kb0qPmCCWm3zzjX'
			);
		},
		baseUrl: 'https://api.abacatepay.com/v1',
	},
	asaas: {
		get apiKey() {
			return (
				process.env['ASAAS_API_KEY'] ||
				'$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjE4ZTIxOTk3LTk1ZjMtNDdmYy04OTcyLWM0ZDcxZGQ5YTNlMTo6JGFhY2hfNDc3MDA3MGEtZDdiNi00MTNhLWE1NjUtMWVmNDNhNDQ5YWEz'
			);
		},
		sandboxUrl: 'https://api-sandbox.asaas.com/v3',
	},
};

export function shouldRunAbacatePayIntegrationTests(): boolean {
	const isCI = process.env['NODE_ENV'] === 'testing';
	const hasAbacatePayKey = !!process.env['ABACATEPAY_API_KEY'];
	if (isCI && !hasAbacatePayKey) return false;
	return true;
}

export function shouldRunAsaasIntegrationTests(): boolean {
	/**
	 * Verificar por que a chave do Asaas não está sendo reconhecida no CI
	 */
	// const isCI = process.env['NODE_ENV'] === 'testing';
	// const hasAsaasKey = !!process.env['ASAAS_API_KEY'];
	// if (isCI && !hasAsaasKey) return false;
	return true;
}
