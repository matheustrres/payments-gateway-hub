export type AdminAuditAction =
	| 'CREATE'
	| 'UPDATE'
	| 'DELETE'
	| 'READ'
	| 'LOGIN';
export type AdminAuditResource =
	| 'PROJECT'
	| 'TRANSACTION'
	| 'ADMIN'
	| 'PROVIDER_CREDENTIAL'
	| 'WEBHOOK' // Retentativas manuais
	| 'AUDIT_LOG' // Quem está consultando os logs de auditoria
	| 'OTHER';
