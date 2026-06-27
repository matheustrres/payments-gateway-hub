import { createHmac } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAdminToken } from './helpers/auth-helper';
import {
	ABACATEPAY_CREDENTIALS,
	ABACATEPAY_WEBHOOK_PAYLOADS,
} from './helpers/credentials-fixtures';
import { MockWebhookServer } from './helpers/mock-webhook-server';

import { AppModule } from '@/app.module';

import {
	ECurrency,
	EPaymentMethod,
	EPaymentStatus,
} from '@/core/enums/payment';
import { EPriority } from '@/core/enums/priority';

import { DatabaseService } from '@/shared/modules/database/database.service';

describe.sequential('E2E: Transaction Audit Summary', () => {
	let app: INestApplication;
	let dbService: DatabaseService;
	let webhookServer: MockWebhookServer;
	let isDatabaseAvailable = true;
	let adminToken: string;

	beforeAll(async () => {
		try {
			const moduleFixture: TestingModule = await Test.createTestingModule({
				imports: [AppModule],
			}).compile();
			app = moduleFixture.createNestApplication();
			app.useGlobalPipes(
				new ValidationPipe({
					whitelist: true,
					forbidNonWhitelisted: true,
					transform: true,
				}),
			);
			app.use(
				json({
					verify: (req: any, _res, buf) => {
						req.rawBody = buf;
					},
				}),
			);
			app.use(
				urlencoded({
					extended: true,
					verify: (req: any, _res, buf) => {
						req.rawBody = buf;
					},
				}),
			);
			await app.init();
			dbService = app.get(DatabaseService);
			webhookServer = new MockWebhookServer(3003);
			await webhookServer.start();
			await dbService.webhookDeliveryLog.deleteMany({});
			await dbService.webhookEvent.deleteMany({});
			await dbService.transactionHistory.deleteMany({});
			await dbService.transaction.deleteMany({});
			await dbService.providerCredential.deleteMany({});
			await dbService.project.deleteMany({});
			adminToken = await getAdminToken(app);
		} catch (error) {
			isDatabaseAvailable = false;
			console.warn('⚠️  Database not available. Skipping E2E tests.');
			console.error('Error:', error);
		}
	});

	afterAll(async () => {
		if (isDatabaseAvailable) {
			await dbService.webhookDeliveryLog.deleteMany({});
			await dbService.webhookEvent.deleteMany({});
			await dbService.transactionHistory.deleteMany({});
			await dbService.transaction.deleteMany({});
			await dbService.providerCredential.deleteMany({});
			await dbService.project.deleteMany({});
		}
		if (webhookServer) await webhookServer.stop();
		if (app) await app.close();
	});

	beforeEach(async () => {
		if (isDatabaseAvailable) {
			await dbService.webhookDeliveryLog.deleteMany({});
			await dbService.webhookEvent.deleteMany({});
			await dbService.transactionHistory.deleteMany({});
			await dbService.transaction.deleteMany({});
			webhookServer.clearRequests();
		}
	});

	async function createProjectWithCredentials(): Promise<{
		projectId: string;
		testApiKey: string;
		liveApiKey: string;
	}> {
		const createProjectResponse = await request(app.getHttpServer())
			.post('/backoffice/projects')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				name: `Test Project Audit ${Date.now()}`,
				webhookUrl: webhookServer.getUrl(),
			})
			.expect(201);
		const projectId = createProjectResponse.body.project.id;
		const testApiKey = createProjectResponse.body.project.testApiKey;
		const liveApiKey = createProjectResponse.body.project.liveApiKey;
		await request(app.getHttpServer())
			.post(`/backoffice/projects/${projectId}/provider-credentials`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({
				...ABACATEPAY_CREDENTIALS,
				priority: EPriority.High,
			})
			.expect(204);
		return { projectId, testApiKey, liveApiKey };
	}

	async function createChargeAndReceiveWebhook(
		apiKey: string,
		projectId: string,
	): Promise<{
		transactionId: string;
		externalId: string;
	}> {
		const idempotencyKey = `idem-audit-${Date.now()}`;
		const createChargeResponse = await request(app.getHttpServer())
			.post('/charges')
			.set('x-api-key', apiKey)
			.send({
				amountInCents: 10000,
				currency: ECurrency.BRL,
				idempotencyKey,
				paymentMethod: EPaymentMethod.Pix,
				isProduction: false,
				details: {
					productName: 'Test Product Audit',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: {
						name: 'João Silva Audit',
						email: 'joao.audit@example.com',
						cellphone: '+5511999999999',
						taxId: '11144477735',
					},
				},
			})
			.expect(201);
		const transactionId = createChargeResponse.body.transaction.id;
		const externalId = createChargeResponse.body.transaction.externalId;
		const webhookPayload = ABACATEPAY_WEBHOOK_PAYLOADS.BILLING_PAID(externalId);
		const webhookSecret = ABACATEPAY_CREDENTIALS.credentials.webhookSecret;
		const payloadString = JSON.stringify(webhookPayload);
		const hmacSignature = createHmac('sha256', webhookSecret)
			.update(payloadString)
			.digest('base64');
		await request(app.getHttpServer())
			.post(`/webhooks/inbound/${projectId}/abacatepay`)
			.set('x-webhook-signature', hmacSignature)
			.set('x-webhook-secret', webhookSecret)
			.send(webhookPayload)
			.expect(201);
		return { transactionId, externalId };
	}

	describe('Authentication and Authorization', () => {
		it('should reject requests without admin token', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.get('/backoffice/audit/transactions/some-id')
				.expect(401);
		});

		it('should reject requests with invalid admin token', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.get('/backoffice/audit/transactions/some-id')
				.set('Authorization', 'Bearer invalid-token')
				.expect(401);
		});
	});

	describe('Transaction Lookup', () => {
		it('should return 404 when transaction does not exist', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.get('/backoffice/audit/transactions/non-existent-id')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});

		it('should find transaction by transactionId (default searchBy)', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId, externalId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.transaction).toMatchObject({
				id: transactionId,
				externalId: externalId,
				status: EPaymentStatus.Paid,
			});
		});

		it('should find transaction by transactionId with explicit searchBy', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId, externalId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.query({ searchBy: 'transactionId' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.transaction).toMatchObject({
				id: transactionId,
				externalId: externalId,
			});
		});

		it('should find transaction by externalId', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId, externalId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${externalId}`)
				.query({ searchBy: 'externalId' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.transaction).toMatchObject({
				id: transactionId,
				externalId: externalId,
			});
		});

		it('should return 404 when searching by externalId that does not exist', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.get('/backoffice/audit/transactions/non-existent-external-id')
				.query({ searchBy: 'externalId' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe('Query Parameter Validation', () => {
		it('should accept valid searchBy values', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.query({ searchBy: 'transactionId' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.query({ searchBy: 'externalId' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});

		it('should reject invalid searchBy values', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.get('/backoffice/audit/transactions/some-id')
				.query({ searchBy: 'invalidValue' })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(400);
		});
	});

	describe('Response Structure', () => {
		it('should return complete audit summary with all layers', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			const { transactionId, externalId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			await webhookServer.waitForWebhook(10000);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body).toHaveProperty('transaction');
			expect(response.body.transaction).toMatchObject({
				id: transactionId,
				externalId: externalId,
				status: EPaymentStatus.Paid,
				amountInCents: 10000,
			});
			expect(response.body.transaction).toHaveProperty('createdAt');
			expect(response.body).toHaveProperty('inbound');
			expect(response.body.inbound).not.toBeNull();
			expect(response.body.inbound).toMatchObject({
				provider: 'abacatepay',
			});
			expect(response.body.inbound).toHaveProperty('payload');
			expect(response.body.inbound).toHaveProperty('headers');
			expect(response.body.inbound).toHaveProperty('receivedAt');
			expect(response.body).toHaveProperty('timeline');
			expect(Array.isArray(response.body.timeline)).toBe(true);
			expect(response.body.timeline.length).toBeGreaterThanOrEqual(1);
			expect(response.body.timeline[0]).toHaveProperty('from');
			expect(response.body.timeline[0]).toHaveProperty('to');
			expect(response.body.timeline[0]).toHaveProperty('trigger');
			expect(response.body.timeline[0]).toHaveProperty('createdAt');
			expect(response.body).toHaveProperty('outbound');
			expect(Array.isArray(response.body.outbound)).toBe(true);
		});

		it('should return null inbound when transaction has no webhook event', async () => {
			if (!isDatabaseAvailable) return;
			const { testApiKey } = await createProjectWithCredentials();
			const idempotencyKey = `idem-no-webhook-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 5000,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test No Webhook',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Test User',
							email: 'test@example.com',
							cellphone: '+5511999999999',
							taxId: '11144477735',
						},
					},
				})
				.expect(201);
			const transactionId = createChargeResponse.body.transaction.id;
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.inbound).toBeNull();
			expect(response.body.timeline).toEqual([
				expect.objectContaining({
					from: 'NONE',
					to: 'PENDING',
					trigger: 'API_CREATE',
				}),
			]);
		});
	});

	describe('Header Sanitization', () => {
		it('should sanitize sensitive headers in inbound webhook', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.inbound).not.toBeNull();
			expect(response.body.inbound.headers).toBeDefined();
			const headers = response.body.inbound.headers;
			const sensitiveKeys = [
				'authorization',
				'x-api-key',
				'api-key',
				'access_token',
				'cookie',
				'asaas-access-token',
			];
			for (const key of Object.keys(headers)) {
				const lowerKey = key.toLowerCase();
				if (sensitiveKeys.includes(lowerKey)) {
					expect(headers[key]).toBe('[REDACTED]');
				}
			}
		});
	});

	describe('Timeline Tracking', () => {
		it('should show status transitions in timeline', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const { transactionId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.timeline.length).toBeGreaterThanOrEqual(1);
			const paidTransition = response.body.timeline.find(
				(t: any) => t.to === EPaymentStatus.Paid,
			);
			expect(paidTransition).toBeDefined();
			expect(paidTransition.trigger).toBe('WEBHOOK');
		});
	});

	describe('Outbound Webhook Delivery', () => {
		it('should show outbound webhook delivery attempts', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			const { transactionId } = await createChargeAndReceiveWebhook(
				testApiKey,
				projectId,
			);
			await webhookServer.waitForWebhook(10000);
			const response = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.outbound.length).toBeGreaterThanOrEqual(1);
			const outboundEntry = response.body.outbound[0];
			expect(outboundEntry).toHaveProperty('url');
			expect(outboundEntry).toHaveProperty('success');
			expect(outboundEntry).toHaveProperty('statusCode');
			expect(outboundEntry).toHaveProperty('durationInMs');
			expect(outboundEntry).toHaveProperty('attempts');
			expect(outboundEntry).toHaveProperty('lastAttemptAt');
		});
	});

	describe('Complete Payment Flow Audit', () => {
		it('should trace complete PIX payment lifecycle', async () => {
			if (!isDatabaseAvailable) return;
			const { projectId, testApiKey } = await createProjectWithCredentials();
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			const idempotencyKey = `idem-complete-flow-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 25000,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Complete Flow Test',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Complete Flow User',
							email: 'complete@example.com',
							cellphone: '+5511999999999',
							taxId: '11144477735',
						},
					},
				})
				.expect(201);
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			let auditResponse = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(auditResponse.body.transaction.status).toBe(
				EPaymentStatus.Pending,
			);
			expect(auditResponse.body.inbound).toBeNull();
			expect(auditResponse.body.timeline).toEqual([
				expect.objectContaining({
					from: 'NONE',
					to: 'PENDING',
					trigger: 'API_CREATE',
				}),
			]);
			const webhookPayload =
				ABACATEPAY_WEBHOOK_PAYLOADS.BILLING_PAID(externalId);
			const webhookSecret = ABACATEPAY_CREDENTIALS.credentials.webhookSecret;
			const payloadString = JSON.stringify(webhookPayload);
			const hmacSignature = createHmac('sha256', webhookSecret)
				.update(payloadString)
				.digest('base64');
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/abacatepay`)
				.set('x-webhook-signature', hmacSignature)
				.set('x-webhook-secret', webhookSecret)
				.send(webhookPayload)
				.expect(201);
			await webhookServer.waitForWebhook(10000);
			auditResponse = await request(app.getHttpServer())
				.get(`/backoffice/audit/transactions/${transactionId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);
			expect(auditResponse.body.transaction.status).toBe(EPaymentStatus.Paid);
			expect(auditResponse.body.transaction.amountInCents).toBe(25000);
			expect(auditResponse.body.inbound).not.toBeNull();
			expect(auditResponse.body.inbound.provider).toBe('abacatepay');
			expect(auditResponse.body.inbound.payload).toBeDefined();
			expect(auditResponse.body.timeline.length).toBeGreaterThanOrEqual(1);
			const statusTransition = auditResponse.body.timeline.find(
				(t: any) => t.to === EPaymentStatus.Paid,
			);
			expect(statusTransition).toBeDefined();
			expect(statusTransition.from).toBe(EPaymentStatus.Pending);
			expect(statusTransition.trigger).toBe('WEBHOOK');
			expect(auditResponse.body.outbound.length).toBeGreaterThanOrEqual(1);
			const outbound = auditResponse.body.outbound[0];
			expect(outbound.url).toContain(
				webhookServer.getUrl().replace('/webhook', ''),
			);
			expect(outbound.success).toBe(true);
			expect(outbound.statusCode).toBe(200);
			expect(outbound.attempts).toBeGreaterThanOrEqual(1);
			console.log('✅ Complete Payment Flow Audit Test Passed');
			console.log(`   Transaction ID: ${transactionId}`);
			console.log(`   External ID: ${externalId}`);
			console.log(`   Timeline entries: ${auditResponse.body.timeline.length}`);
			console.log(
				`   Outbound deliveries: ${auditResponse.body.outbound.length}`,
			);
		});
	});
});
