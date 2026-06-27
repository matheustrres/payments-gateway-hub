import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { EHttpStatusCode } from '@/core/enums/status-code';

type ProblemDetails = {
	type: string;
	title: string;
	status: number;
	detail: string | string[];
	instance: string;
};

type HttpValidationResponse = {
	message: string | string[];
	error: string;
	statusCode: number;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
	constructor(
		private readonly httpAdapterHost: HttpAdapterHost<ExpressAdapter>,
		private readonly logger: PinoLogger,
	) {
		this.logger.setContext(GlobalExceptionFilter.name);
	}

	catch(exception: unknown, host: ArgumentsHost): void {
		this.#logError('An unhandled exception was caught', exception);
		const { httpAdapter } = this.httpAdapterHost;
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const requestUrl = httpAdapter.getRequestUrl(ctx.getRequest());
		const problemDetails = this.#mapToProblemDetails(exception, requestUrl);
		return this.#sendResponse(httpAdapter, response, problemDetails);
	}

	#mapToProblemDetails(exception: unknown, requestUrl: string): ProblemDetails {
		const defaultStatus = EHttpStatusCode.InternalServerError;
		const problemDetails: ProblemDetails = {
			type: this.#getType(defaultStatus),
			status: defaultStatus,
			title: 'Internal Server Error',
			detail: 'An unexpected error occurred. Please try again later.',
			instance: requestUrl,
		};
		if (exception instanceof HttpException) {
			const { message, statusCode } =
				exception.getResponse() as HttpValidationResponse;
			return {
				...problemDetails,
				type: this.#getType(statusCode),
				title: HttpStatus[statusCode] || 'Error',
				status: statusCode,
				detail: Array.isArray(message) ? message : [message],
			};
		}
		if (exception instanceof Error) {
			return {
				...problemDetails,
				detail: exception.message || problemDetails.detail,
			};
		}
		return problemDetails;
	}

	#getType(statusCode: number): string {
		return `https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Status/${statusCode}`;
	}

	#logError(message: string, exception: unknown): void {
		const serializedError = this.#serializeError(exception);
		this.logger.assign({ err: serializedError });
		this.logger.error(message);
	}

	#serializeError(exception: unknown): Record<string, unknown> {
		if (exception instanceof HttpException) {
			const response = exception.getResponse() as HttpValidationResponse;
			return {
				type: exception.constructor.name,
				message: exception.message,
				statusCode: response.statusCode,
			};
		}
		if (exception instanceof Error) {
			return {
				type: exception.constructor.name,
				message: exception.message,
			};
		}
		return { type: 'Unknown', message: String(exception) };
	}

	#sendResponse(
		httpAdapter: ExpressAdapter,
		response: Response,
		problemDetails: ProblemDetails,
	): void {
		return httpAdapter.reply(response, problemDetails, problemDetails.status);
	}
}
