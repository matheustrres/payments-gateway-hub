import { EPaymentProvider } from '@/core/enums/payment';

/**
 * Credentials fixtures for E2E tests
 * These use the REAL sandbox/homolog keys from .env.test
 */

export const ABACATEPAY_CREDENTIALS = {
	provider: EPaymentProvider.AbacatePay,
	credentials: {
		apiKey:
			process.env['ABACATEPAY_API_KEY'] || 'abc_dev_DuT3q1eD3Kb0qPmCCWm3zzjX',
		webhookSecret: 'test-webhook-secret-abacatepay',
	},
	isProduction: false,
};

export const ASAAS_CREDENTIALS = {
	provider: EPaymentProvider.Asaas,
	credentials: {
		apiKey:
			process.env['ASAAS_API_KEY'] ||
			'$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjE4ZTIxOTk3LTk1ZjMtNDdmYy04OTcyLWM0ZDcxZGQ5YTNlMTo6JGFhY2hfNDc3MDA3MGEtZDdiNi00MTNhLWE1NjUtMWVmNDNhNDQ5YWEz',
		webhookSecret: 'test-webhook-secret-asaas',
	},
	isProduction: false,
};

/**
 * Webhook secrets for signature validation
 */
export const WEBHOOK_SECRETS = {
	AbacatePay: 'test-webhook-secret-abacatepay',
	Asaas: 'test-webhook-secret-asaas',
};

/**
 * Sample webhook payloads from providers
 */
export const ABACATEPAY_WEBHOOK_PAYLOADS = {
	BILLING_PAID: (billingId: string) => ({
		id: 'evt_' + Date.now(),
		event: 'billing.updated',
		data: {
			billing: {
				id: billingId,
				amount: 10000,
				frequency: 'ONE_TIME',
				status: 'PAID',
				paidAmount: 10000,
				couponsUsed: [],
			},
			payment: {
				amount: 10000,
				fee: 250,
				method: 'PIX',
			},
		},
	}),

	BILLING_EXPIRED: (billingId: string) => ({
		id: 'evt_' + Date.now(),
		event: 'billing.updated',
		data: {
			billing: {
				id: billingId,
				amount: 10000,
				frequency: 'ONE_TIME',
				status: 'EXPIRED',
				paidAmount: 0,
				couponsUsed: [],
			},
			payment: null,
		},
	}),
};

export const ASAAS_WEBHOOK_PAYLOADS = {
	PAYMENT_CONFIRMED: (paymentId: string) => ({
		event: 'PAYMENT_CONFIRMED',
		payment: {
			id: paymentId,
			customer: 'cus_000000000000',
			billingType: 'CREDIT_CARD',
			status: 'CONFIRMED',
			value: 100.0,
			netValue: 95.5,
			invoiceUrl: `https://sandbox.asaas.com/i/${paymentId}`,
			creditCard: {
				creditCardBrand: 'VISA',
				creditCardNumber: '1111',
			},
		},
	}),

	PAYMENT_RECEIVED: (paymentId: string) => ({
		event: 'PAYMENT_RECEIVED',
		payment: {
			id: paymentId,
			customer: 'cus_000000000001',
			billingType: 'BOLETO',
			status: 'RECEIVED',
			value: 200.0,
			netValue: 196.0,
			bankSlipUrl: `https://sandbox.asaas.com/b/${paymentId}`,
		},
	}),

	PAYMENT_OVERDUE: (paymentId: string) => ({
		event: 'PAYMENT_OVERDUE',
		payment: {
			id: paymentId,
			status: 'OVERDUE',
			value: 50.0,
		},
	}),

	PAYMENT_REFUNDED: (paymentId: string) => ({
		event: 'PAYMENT_REFUNDED',
		payment: {
			id: paymentId,
			status: 'REFUNDED',
			value: 75.0,
		},
	}),
};
