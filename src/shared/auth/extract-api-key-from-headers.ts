import { IncomingHttpHeaders } from 'node:http';

export function extractApiKeyFromHeaders(
	headers: IncomingHttpHeaders,
): string | undefined {
	return headers['x-api-key'] as string | undefined;
}
