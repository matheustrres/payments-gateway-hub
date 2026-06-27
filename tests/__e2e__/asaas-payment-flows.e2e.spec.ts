import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAdminToken } from './helpers/auth-helper';
import {
	ASAAS_CREDENTIALS,
	ASAAS_WEBHOOK_PAYLOADS,
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

describe.sequential('E2E: Asaas Payment Flows', () => {
	let app: INestApplication;
	let dbService: DatabaseService;
	let webhookServer: MockWebhookServer;
	let isDatabaseAvailable = true;
	let adminToken: string;

	let projectId: string;
	let testApiKey: string;
	let liveApiKey: string;

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
			webhookServer = new MockWebhookServer(3002);
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

	describe('Credit Card Payment Flow', () => {
		it('should complete full credit card payment lifecycle: create project → configure credentials → create charge → receive webhook → send outbound webhook', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// ========================================
			// STEP 1: Create project and get API keys
			// ========================================
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Card Test Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			liveApiKey = createProjectResponse.body.project.liveApiKey;
			expect(projectId).toBeDefined();
			expect(testApiKey).toBeDefined();
			expect(liveApiKey).toBeDefined();
			// ========================================
			// STEP 2: Configure Asaas credentials
			// ========================================
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);
			// ========================================
			// STEP 3: Create credit card charge
			// ========================================
			const idempotencyKey = `idempotency-card-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000, // R$ 100.00
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Card,
					details: {
						customer: {
							name: 'John Doe',
							email: 'john.doe@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '31',
						},
						card: {
							holderName: 'John Doe',
							number: '4000000000000010',
							expiryMonth: '12',
							expiryYear: '2030',
							cvv: '123',
						},
					},
				});
			if (createChargeResponse.status !== 201) {
				const errorMessage = `
❌ Charge creation failed with status: ${createChargeResponse.status}

Response body:
${JSON.stringify(createChargeResponse.body, null, 2)}
`;
				throw new Error(errorMessage);
			}
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			expect(transactionId).toBeDefined();
			expect(externalId).toBeDefined();
			// Asaas sandbox approves credit card payments immediately
			expect(createChargeResponse.body.transaction.status).toBe(
				EPaymentStatus.Paid,
			);
			// ========================================
			// STEP 4: Simulate Asaas webhook (PAYMENT_CONFIRMED)
			// ========================================
			const webhookPayload =
				ASAAS_WEBHOOK_PAYLOADS.PAYMENT_CONFIRMED(externalId);
			// Asaas uses direct token validation (not HMAC)
			const webhookToken = ASAAS_CREDENTIALS.credentials.webhookSecret;
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(webhookPayload)
				.expect(201);
			// Verify transaction was updated
			const updatedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(updatedTransaction).toBeDefined();
			expect(updatedTransaction!.status).toBe(EPaymentStatus.Paid);
			// ========================================
			// STEP 5: Verify outbound webhook was sent
			// ========================================
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			const outboundWebhook = await webhookServer.waitForWebhook(10000);
			expect(outboundWebhook.body).toHaveProperty(
				'eventType',
				'transaction.paid',
			);
			expect(outboundWebhook.body.data).toHaveProperty(
				'transactionId',
				transactionId,
			);
			expect(outboundWebhook.body).toHaveProperty(
				'status',
				EPaymentStatus.Paid,
			);
			expect(outboundWebhook.body.data.provider).toHaveProperty(
				'id',
				externalId,
			);
			const isSignatureValid = webhookServer.validateSignature(outboundWebhook);
			expect(isSignatureValid).toBe(true);
		});
	});

	describe('Boleto Payment Flow', () => {
		it('should complete full boleto payment lifecycle: create project → configure credentials → create charge → receive webhook → send outbound webhook', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// ========================================
			// STEP 1: Create project and get API keys
			// ========================================
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Boleto Test Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			liveApiKey = createProjectResponse.body.project.liveApiKey;
			expect(projectId).toBeDefined();
			expect(testApiKey).toBeDefined();
			expect(liveApiKey).toBeDefined();
			// ========================================
			// STEP 2: Configure Asaas credentials
			// ========================================
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);
			// ========================================
			// STEP 3: Create boleto charge
			// ========================================
			const idempotencyKey = `idempotency-boleto-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 20000, // R$ 200.00
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Boleto,
					details: {
						customer: {
							name: 'Jane Smith',
							email: 'jane.smith@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '500',
						},
					},
				})
				.expect(201);
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			expect(transactionId).toBeDefined();
			expect(externalId).toBeDefined();
			expect(createChargeResponse.body.transaction.status).toBe(
				EPaymentStatus.Pending,
			);
			// ========================================
			// STEP 4: Simulate Asaas webhook (PAYMENT_RECEIVED)
			// ========================================
			const webhookPayload =
				ASAAS_WEBHOOK_PAYLOADS.PAYMENT_RECEIVED(externalId);
			// Asaas uses direct token validation (not HMAC)
			const webhookToken = ASAAS_CREDENTIALS.credentials.webhookSecret;
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(webhookPayload)
				.expect(201);
			// Verify transaction was updated
			const updatedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(updatedTransaction).toBeDefined();
			expect(updatedTransaction!.status).toBe(EPaymentStatus.Paid);
			// ========================================
			// STEP 5: Verify outbound webhook was sent
			// ========================================
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			// Wait for SQS consumer to process and send webhook to mock server
			const outboundWebhook = await webhookServer.waitForWebhook(10000);
			// Verify webhook payload structure
			expect(outboundWebhook.body).toHaveProperty(
				'eventType',
				'transaction.paid',
			);
			expect(outboundWebhook.body.data).toHaveProperty(
				'transactionId',
				transactionId,
			);
			expect(outboundWebhook.body).toHaveProperty(
				'status',
				EPaymentStatus.Paid,
			);
			expect(outboundWebhook.body.data.provider).toHaveProperty(
				'id',
				externalId,
			);
			// Verify webhook signature is valid
			const isSignatureValid = webhookServer.validateSignature(outboundWebhook);
			expect(isSignatureValid).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle PAYMENT_OVERDUE webhook and update transaction to Expired', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// Setup project and credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Overdue Test Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);
			// Create boleto charge
			const idempotencyKey = `idempotency-overdue-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 5000,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Boleto,
					details: {
						customer: {
							name: 'Test User',
							email: 'test.user@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '100',
						},
					},
				})
				.expect(201);
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			// Send PAYMENT_OVERDUE webhook
			const webhookPayload = ASAAS_WEBHOOK_PAYLOADS.PAYMENT_OVERDUE(externalId);
			// Asaas uses direct token validation (not HMAC)
			const webhookToken = ASAAS_CREDENTIALS.credentials.webhookSecret;
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(webhookPayload)
				.expect(201);
			// Verify transaction status changed to EXPIRED
			const updatedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(updatedTransaction).toBeDefined();
			expect(updatedTransaction!.status).toBe(EPaymentStatus.Expired);

			// Wait for outbound webhook to ensure background jobs finish
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			await webhookServer.waitForWebhook(10000);
		});

		it('should handle PAYMENT_REFUNDED webhook and update transaction to Refunded', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// Setup project and credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Refund Test Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);
			// Create card charge
			const idempotencyKey = `idempotency-refund-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 7500,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Card,
					details: {
						customer: {
							name: 'Refund Test',
							email: 'refund.test@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '200',
						},
						card: {
							holderName: 'REFUND TEST',
							number: '5162306219378829',
							expiryMonth: '12',
							expiryYear: '2030',
							cvv: '123',
						},
					},
				})
				.expect(201);
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			// First, confirm payment
			const confirmedPayload =
				ASAAS_WEBHOOK_PAYLOADS.PAYMENT_CONFIRMED(externalId);
			// Asaas uses direct token validation (not HMAC)
			const webhookToken = ASAAS_CREDENTIALS.credentials.webhookSecret;
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(confirmedPayload)
				.expect(201);
			// Then, send refund webhook
			const refundPayload = ASAAS_WEBHOOK_PAYLOADS.PAYMENT_REFUNDED(externalId);
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(refundPayload)
				.expect(201);
			// Verify transaction status changed to REFUNDED
			const updatedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(updatedTransaction).toBeDefined();
			expect(updatedTransaction!.status).toBe(EPaymentStatus.Refunded);

			// Wait for outbound webhooks to ensure background jobs finish
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			await webhookServer.waitForWebhook(10000); // Paid
			await webhookServer.waitForWebhook(10000); // Refunded
		});

		it('should reject charge creation with missing required customer fields', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// Setup project
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Validation Test Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);
			// Try to create charge without customer email
			const response = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `test-${Date.now()}`,
					paymentMethod: EPaymentMethod.Card,
					details: {
						customer: {
							name: 'Test User',
							// email missing
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '100',
						},
						card: {
							holderName: 'TEST USER',
							number: '5162306219378829',
							expiryMonth: '12',
							expiryYear: '2030',
							cvv: '123',
						},
					},
				})
				.expect(400);
			expect(response.body).toBeDefined();
		});

		it('should reject charge creation when project has no Asaas credentials', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// Create project WITHOUT configuring credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'No Credentials Project',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const noCredsApiKey = createProjectResponse.body.project.testApiKey;
			// Try to create charge - should fail due to missing credentials
			const response = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', noCredsApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `no-creds-${Date.now()}`,
					paymentMethod: EPaymentMethod.Card,
					details: {
						customer: {
							name: 'Test User',
							email: 'test.user@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '100',
						},
						card: {
							holderName: 'TEST USER',
							number: '5162306219378829',
							expiryMonth: '12',
							expiryYear: '2030',
							cvv: '123',
						},
					},
				})
				.expect(400);
			expect(response.body).toBeDefined();
		});

		it('should allow valid progressive transitions (PAID → REFUNDED)', async () => {
			if (!isDatabaseAvailable) {
				console.warn('⚠️  Skipping test - database not available');
				return;
			}
			// This test validates that the anti-regression logic ONLY blocks
			// downgrades (PAID → PENDING/FAILED), not valid progressions like PAID → REFUNDED

			// Setup project and credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: 'Asaas Progressive Transition Test',
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					provider: ASAAS_CREDENTIALS.provider,
					priority: EPriority.High,
					credentials: ASAAS_CREDENTIALS.credentials,
					isProduction: ASAAS_CREDENTIALS.isProduction,
				})
				.expect(204);

			// Create charge (credit card = instant PAID in sandbox)
			const idempotencyKey = `idempotency-progressive-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Card,
					details: {
						customer: {
							name: 'Progressive Test',
							email: 'progressive.test@gmail.com',
							cellphone: '+5521976592612',
							taxId: '13197772792',
							postalCode: '21720250',
							addressNumber: '100',
						},
						card: {
							holderName: 'PROGRESSIVE TEST',
							number: '4000000000000010',
							expiryMonth: '12',
							expiryYear: '2030',
							cvv: '123',
						},
					},
				})
				.expect(201);

			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;

			// Transaction should be PAID (sandbox instant approval)
			let transaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(transaction!.status).toBe(EPaymentStatus.Paid);

			// Send REFUNDED webhook (valid progression PAID → REFUNDED)
			const refundPayload = ASAAS_WEBHOOK_PAYLOADS.PAYMENT_REFUNDED(externalId);
			const webhookToken = ASAAS_CREDENTIALS.credentials.webhookSecret;
			await request(app.getHttpServer())
				.post(`/webhooks/inbound/${projectId}/asaas`)
				.set('asaas-access-token', webhookToken)
				.send(refundPayload)
				.expect(201);

			// Transaction should now be REFUNDED (progression allowed)
			transaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(transaction!.status).toBe(EPaymentStatus.Refunded);

			// Verify webhook event was processed successfully (no error message)
			const webhookEvents = await dbService.webhookEvent.findMany({
				where: { projectId, transactionId },
				orderBy: { receivedAt: 'desc' },
			});
			const refundWebhookEvent = webhookEvents[0];
			expect(refundWebhookEvent!.status).toBe('Processed');
			expect(refundWebhookEvent!.errorMessage).toBeNull();

			// Wait for outbound webhook to ensure background jobs finish
			const project = await dbService.project.findUnique({
				where: { id: projectId },
			});
			webhookServer.setExpectedSecret(project!.liveApiKeyHash);
			await webhookServer.waitForWebhook(10000);
		});
	});
});
