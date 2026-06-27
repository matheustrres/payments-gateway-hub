export enum EWebhookEventStatus {
	/**
	 * Estado inicial do evento de webhook
	 */
	Pending = 'Pending',
	/**
	 * Transação já foi paga (Paid)
	 */
	Processed = 'Processed',
	Failed = 'Failed',
	/**
	 * Transação não encontrada no sistema
	 */
	Ignored = 'Ignored',
}
