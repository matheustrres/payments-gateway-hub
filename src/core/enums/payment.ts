export enum ECurrency {
	BRL = 'BRL',
	USD = 'USD',
	EUR = 'EUR',
}

export enum EPaymentMethod {
	Boleto = 'BOLETO',
	Card = 'CREDIT_CARD',
	Pix = 'PIX',
	Wire = 'WIRE',
}

export enum EPaymentProvider {
	AbacatePay = 'abacatepay',
	Payoneer = 'payoneer',
	Asaas = 'asaas',
}

export enum EPaymentStatus {
	Cancelled = 'CANCELLED',
	Expired = 'EXPIRED',
	Failed = 'FAILED',
	Paid = 'PAID',
	Pending = 'PENDING',
	Refunded = 'REFUNDED',
	Chargeback = 'CHARGEBACK',
}

// export enum EAsaasPaymentStatus {
// 	AwaitingChargebackReversal = 'AWAITING_CHARGEBACK_REVERSAL',
// 	AwaitingRiskAnalysis = 'AWAITING_RISK_ANALYSIS',
// 	Cancelled = 'CANCELLED',
// 	ChargebackRequested = 'CHARGEBACK_REQUESTED',
// 	ChargebackDispute = 'CHARGEBACK_DISPUTE',
// 	Confirmed = 'CONFIRMED',
// 	DunningRequested = 'DUNNING_REQUESTED',
// 	DunningReceived = 'DUNNING_RECEIVED',
// 	Overdue = 'OVERDUE',
// 	Paid = 'PAID',
// 	Pending = 'PENDING',
// 	Refunded = 'REFUNDED',
// 	RefundRequested = 'REFUND_REQUESTED',
// 	RefundInProgress = 'REFUND_IN_PROGRESS',
// 	Received = 'RECEIVED',
// 	ReceivedInCash = 'RECEIVED_IN_CASH',
// }
