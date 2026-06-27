import { createHmac } from 'node:crypto';
import {
	createServer,
	IncomingMessage,
	Server,
	ServerResponse,
} from 'node:http';

export type WebhookRequest = {
	headers: Record<string, string | string[] | undefined>;
	body: any;
	receivedAt: Date;
};

export class MockWebhookServer {
	private server: Server | null = null;
	private port: number;
	private requests: WebhookRequest[] = [];
	private expectedSecret: string | null = null;

	constructor(port: number = 3001) {
		this.port = port;
	}

	/**
	 * Starts the mock webhook server
	 */
	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server = createServer(this.handleRequest.bind(this));
			this.server.on('error', (error) => {
				reject(error);
			});
			this.server.listen(this.port, () => {
				console.log(
					`🌐 Mock webhook server listening on http://localhost:${this.port}`,
				);
				resolve();
			});
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.server) {
				resolve();
				return;
			}
			this.server.close((error) => {
				if (error) {
					reject(error);
				} else {
					console.log('🛑 Mock Webhook Server stopped');
					this.server = null;
					resolve();
				}
			});
		});
	}

	setExpectedSecret(secret: string): void {
		this.expectedSecret = secret;
	}

	getUrl(): string {
		return `http://localhost:${this.port}/webhook`;
	}

	getRequests(): WebhookRequest[] {
		return this.requests;
	}

	getLastRequest(): WebhookRequest | null {
		return this.requests[this.requests.length - 1] || null;
	}

	clearRequests(): void {
		this.requests = [];
	}

	async waitForWebhook(timeoutMs: number = 5000): Promise<WebhookRequest> {
		const startTime = Date.now();
		return new Promise((resolve, reject) => {
			const checkInterval = setInterval(() => {
				if (this.requests.length > 0) {
					clearInterval(checkInterval);
					resolve(this.requests[this.requests.length - 1]!);
				} else if (Date.now() - startTime > timeoutMs) {
					clearInterval(checkInterval);
					reject(new Error(`Webhook not received within ${timeoutMs}ms`));
				}
			}, 100);
		});
	}

	validateSignature(request: WebhookRequest): boolean {
		if (!this.expectedSecret) {
			return true; // No validation if secret not set
		}
		const signature = request.headers['x-hub-signature'];
		if (!signature || typeof signature !== 'string') {
			return false;
		}
		const bodyString = JSON.stringify(request.body);
		const expectedSignature = createHmac('sha256', this.expectedSecret)
			.update(bodyString)
			.digest('hex');
		return signature === expectedSignature;
	}

	/**
	 * Internal request handler
	 */
	private handleRequest(req: IncomingMessage, res: ServerResponse): void {
		if (req.method !== 'POST') {
			res.writeHead(405, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Method not allowed' }));
			return;
		}
		let body = '';
		req.on('data', (chunk) => {
			body += chunk.toString();
		});
		req.on('end', () => {
			try {
				const parsedBody = JSON.parse(body);
				const webhookRequest: WebhookRequest = {
					headers: req.headers as Record<string, string | string[] | undefined>,
					body: parsedBody,
					receivedAt: new Date(),
				};
				this.requests.push(webhookRequest);
				console.log(
					`📬 Webhook received at ${webhookRequest.receivedAt.toISOString()}`,
				);
				console.log(`   Event Type: ${parsedBody.eventType}`);
				console.log(`   Transaction ID: ${parsedBody.data?.transactionId}`);
				// Validate signature if secret is set
				if (this.expectedSecret) {
					const isValid = this.validateSignature(webhookRequest);
					if (!isValid) {
						console.warn('⚠️  Invalid webhook signature');
						res.writeHead(401, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Invalid signature' }));
						return;
					}
					console.log('✅ Signature validated successfully');
				}
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ received: true }));
			} catch (error) {
				console.error('❌ Error parsing webhook body:', error);
				res.writeHead(400, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Invalid JSON' }));
			}
		});
		req.on('error', (error) => {
			console.error('❌ Request error:', error);
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Internal server error' }));
		});
	}
}
