import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export type GetTransactionAuditSummaryUseCaseInput = {
	transactionId?: string;
	externalId?: string;
};

export type GetTransactionAuditSummaryUseCaseOutput = {
	transaction: {
		id: string;
		externalId: string;
		status: string;
		amountInCents: number;
		createdAt: Date;
	};
	inbound: {
		provider: string;
		status: string;
		payload: unknown;
		headers: Record<string, string>;
		attempts: number;
		nextRetryAt: Date | null;
		errorMessage: string | null;
		receivedAt: Date;
	} | null;
	timeline: Array<{
		from: string;
		to: string;
		trigger: string;
		createdAt: Date;
	}>;
	outbound: Array<{
		url: string;
		success: boolean;
		statusCode: number | null;
		durationInMs: number;
		attempts: number;
		lastAttemptAt: Date;
		errorMessage?: string;
	}>;
	retentionNotice?: string;
};

export class GetTransactionAuditSummaryQueryDto {
	@ApiPropertyOptional({
		description:
			'Define se a busca será pelo ID interno ou ID externo do gateway',
		enum: ['transactionId', 'externalId'],
		default: 'transactionId',
	})
	@IsOptional()
	@IsString()
	@IsIn(['transactionId', 'externalId'], {
		message: 'O parâmetro "by" deve ser "transactionId" ou "externalId"',
	})
	searchBy?: 'transactionId' | 'externalId';
}
