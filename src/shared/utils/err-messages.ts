export const errorMessages = {
	auth: {
		invalidCredentials: 'Credenciais inválidas.',
	},
	encryption: {
		decryptionFailed: 'Falha ao descriptografar dados sensíveis.',
		encryptionFailed: 'Falha ao criptografar dados sensíveis.',
		invalidFormat: 'Formato de credenciais criptografadas inválido.',
	},
	money: {
		invalidCentsAmount: 'O valor em centavos não pode ser negativo.',
		invalidSubtractionResult: 'O resultado da subtração não pode ser negativo.',
		valueTooLargeForSafeConversion:
			'Valor muito grande para conversão segura para número.',
		invalidMultiplicationFactor:
			'O fator de multiplicação não pode ser negativo.',
		invalidDivisionDivisor: 'O divisor deve ser maior que zero.',
		invalidCurrencyOperation: (from: string, to: string) =>
			`Não é possível realizar operações entre moedas diferentes: ${from} e ${to}.`,
	},
	projects: {
		notFound: 'Projeto não encontrado.',
		effectiveProjectIdRequired:
			'projectId é obrigatório quando não se está buscando por idempotencyKey.',
		nameAlreadyTaken: 'O nome do projeto já está em uso.',
	},
	transactions: {
		creationFailed: 'Falha ao criar a transação.',
		notFound: 'Transação não encontrada.',
	},
	providersCredentials: {
		emptyCredentials: 'As credenciais não podem estar vazias.',
		missingApiKey: 'Credenciais salvas não contém o campo "apiKey".',
		notFoundForProviderAndProject:
			'Credenciais do provedor não encontradas para o projeto e ambiente informados.',
	},
} as const;
