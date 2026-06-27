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

describe.sequential('E2E: AbacatePay PIX Complete Flow', () => {
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
			// Configure middleware for rawBody support (needed for webhook signature validation)
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
			webhookServer = new MockWebhookServer(3001);
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

	describe('Complete PIX Payment Flow', () => {
		it('should complete full PIX payment lifecycle: create project → configure credentials → create charge → receive webhook → send outbound webhook', async () => {
			if (!isDatabaseAvailable) return;
			// ============================================
			// STEP 1: Create Project
			// ============================================
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test Project ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			expect(createProjectResponse.body).toHaveProperty('project');
			expect(createProjectResponse.body.project).toHaveProperty('id');
			expect(createProjectResponse.body.project).toHaveProperty('testApiKey');
			expect(createProjectResponse.body.project).toHaveProperty('liveApiKey');
			projectId = createProjectResponse.body.project.id;
			testApiKey = createProjectResponse.body.project.testApiKey;
			liveApiKey = createProjectResponse.body.project.liveApiKey;
			console.log(`✅ Project created: ${projectId}`);
			console.log(`   Test API Key: ${testApiKey.substring(0, 20)}...`);
			const liveApiKeyHash = liveApiKey; // In real scenario, this would be hashed
			webhookServer.setExpectedSecret(liveApiKeyHash);
			// ============================================
			// STEP 2: Configure AbacatePay Credentials
			// ============================================
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);
			const savedCredentials = await dbService.providerCredential.findMany({
				where: { projectId },
			});
			expect(savedCredentials).toHaveLength(1);
			expect(savedCredentials[0]!.provider).toBe('abacatepay');
			// ============================================
			// STEP 3: Create PIX Charge
			// ============================================
			const idempotencyKey = `idem-pix-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000, // R$ 100.00
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product E2E',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'João Silva E2E',
							email: 'joao.e2e@example.com',
							cellphone: '+5511999999999',
							taxId: '11144477735',
						},
					},
				})
				.expect(201);
			expect(createChargeResponse.body).toHaveProperty('transaction');
			expect(createChargeResponse.body.transaction.status).toBe(
				EPaymentStatus.Pending,
			);
			expect(createChargeResponse.body.transaction).toHaveProperty(
				'externalId',
			);
			expect(createChargeResponse.body.transaction).toHaveProperty(
				'paymentUrl',
			);
			const transactionId = createChargeResponse.body.transaction.id;
			const externalId = createChargeResponse.body.transaction.externalId;
			// Verify transaction was saved as PENDING
			const savedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(savedTransaction).not.toBeNull();
			expect(savedTransaction!.status).toBe(EPaymentStatus.Pending);
			expect(savedTransaction!.externalId).toBe(externalId);
			// ============================================
			// STEP 4: Simulate AbacatePay Webhook (Payment Confirmed)
			// ============================================
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
				.expect(201); // NestJS POST endpoints return 201 by default
			// Verify webhook event was created
			const webhookEvents = await dbService.webhookEvent.findMany({
				where: { projectId },
			});
			expect(webhookEvents).toHaveLength(1);
			expect(webhookEvents[0]!.status).toBe('Processed');
			expect(webhookEvents[0]!.transactionId).toBe(transactionId);
			const updatedTransaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(updatedTransaction!.status).toBe(EPaymentStatus.Paid);
			// ============================================
			// STEP 5: Verify Outbound Webhook was Sent
			// ============================================
			// Configure mock server to validate webhook signature
			// The SQS consumer signs with project.apiKeys.live.hash
			// We need to fetch the project to get the hash (not the raw key)
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
			const isSignatureValid = webhookServer.validateSignature(outboundWebhook);
			expect(isSignatureValid).toBe(true);
		});

		it('should handle idempotent charge creation', async () => {
			if (!isDatabaseAvailable) return;
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test Project Idempotency ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const projectId = createProjectResponse.body.project.id;
			const testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);
			const idempotencyKey = `idem-pix-same-${Date.now()}`;
			const chargePayload = {
				amountInCents: 10000,
				currency: ECurrency.BRL,
				idempotencyKey,
				paymentMethod: EPaymentMethod.Pix,
				isProduction: false,
				details: {
					productName: 'Test Idempotency',
					returnUrl: 'https://example.com/return',
					completionUrl: 'https://example.com/completion',
					customer: {
						name: 'Test User',
						email: 'test@example.com',
						cellphone: '+5511999999999',
						taxId: '11144477735', // Valid test CPF
					},
				},
			};
			// First charge creation
			const firstResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send(chargePayload)
				.expect(201);
			const firstTransactionId = firstResponse.body.transaction.id;
			// Second charge creation with SAME idempotencyKey
			const secondResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send(chargePayload)
				.expect(201);
			const secondTransactionId = secondResponse.body.transaction.id;
			// Should return the SAME transaction
			expect(secondTransactionId).toBe(firstTransactionId);
			expect(firstResponse.body.transaction.externalId).toBe(
				secondResponse.body.transaction.externalId,
			);
			// Verify only ONE transaction exists in database
			const transactions = await dbService.transaction.findMany({
				where: { idempotencyKey },
			});
			expect(transactions).toHaveLength(1);
		});

		it(
			'should retry failed transaction when creating charge with same idempotencyKey',
			{ timeout: 15000 },
			async () => {
				if (!isDatabaseAvailable) return;
				// Create project and credentials
				const createProjectResponse = await request(app.getHttpServer())
					.post('/backoffice/projects')
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						name: `Test Project Retry ${Date.now()}`,
						webhookUrl: webhookServer.getUrl(),
					})
					.expect(201);
				const projectId = createProjectResponse.body.project.id;
				const testApiKey = createProjectResponse.body.project.testApiKey;
				await request(app.getHttpServer())
					.post(`/backoffice/projects/${projectId}/provider-credentials`)
					.set('Authorization', `Bearer ${adminToken}`)
					.send({
						...ABACATEPAY_CREDENTIALS,
						priority: EPriority.High,
					})
					.expect(204);
				const idempotencyKey = `idem-retry-${Date.now()}`;
				// Create initial transaction
				const firstResponse = await request(app.getHttpServer())
					.post('/charges')
					.set('x-api-key', testApiKey)
					.send({
						amountInCents: 5000,
						currency: ECurrency.BRL,
						idempotencyKey,
						paymentMethod: EPaymentMethod.Pix,
						isProduction: false,
						details: {
							productName: 'Test Retry',
							returnUrl: 'https://example.com/return',
							completionUrl: 'https://example.com/completion',
							customer: {
								name: 'Retry User',
								email: 'retry@example.com',
								cellphone: '+5511999999999',
								taxId: '98765432100',
							},
						},
					})
					.expect(201);
				const transactionId = firstResponse.body.transaction.id;
				// Manually mark transaction as FAILED
				await dbService.transaction.update({
					where: { id: transactionId },
					data: { status: EPaymentStatus.Failed },
				});
				// Verify it's failed
				const failedTransaction = await dbService.transaction.findUnique({
					where: { id: transactionId },
				});
				expect(failedTransaction!.status).toBe(EPaymentStatus.Failed);
				// Retry with SAME idempotencyKey
				const retryResponse = await request(app.getHttpServer())
					.post('/charges')
					.set('x-api-key', testApiKey)
					.send({
						amountInCents: 5000,
						currency: ECurrency.BRL,
						idempotencyKey,
						paymentMethod: EPaymentMethod.Pix,
						isProduction: false,
						details: {
							productName: 'Test Retry',
							returnUrl: 'https://example.com/return',
							completionUrl: 'https://example.com/completion',
							customer: {
								name: 'Retry User',
								email: 'retry@example.com',
								cellphone: '+5511999999999',
								taxId: '98765432100',
							},
						},
					})
					.expect(201);
				// Should be SAME transaction but status changed to PENDING (retry attempt)
				expect(retryResponse.body.transaction.id).toBe(transactionId);
				// Verify transaction was reset to PENDING for retry
				const retriedTransaction = await dbService.transaction.findUnique({
					where: { id: transactionId },
				});
				expect(retriedTransaction!.status).toBe(EPaymentStatus.Pending);
			},
		);
	});

	describe('Validation and Edge Cases', () => {
		it('should reject charge creation with missing required fields', async () => {
			if (!isDatabaseAvailable) return;
			// Create a project first to get valid API key
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test Validation ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const projectId = createProjectResponse.body.project.id;
			const testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);
			// Test 1: Missing customer email
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-no-email-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Test User',
							// email missing
							cellphone: '+5511999999999',
							taxId: '11144477735',
						},
					},
				})
				.expect(400);
			// Test 2: Missing customer taxId
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-no-taxid-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Test User',
							email: 'test@example.com',
							cellphone: '+5511999999999',
							// taxId missing
						},
					},
				})
				.expect(400);
			// Test 3: Missing returnUrl
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-no-return-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
						// returnUrl missing
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Test User',
							email: 'test@example.com',
							cellphone: '+5511999999999',
							taxId: '11144477735',
						},
					},
				})
				.expect(400);
			// Test 4: Invalid amount (zero)
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 0,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-zero-amount-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
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
				.expect(400);
			// Test 5: Missing idempotencyKey
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					// idempotencyKey missing
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
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
				.expect(400);
		});

		it('should reject charge creation when project has no provider credentials', async () => {
			if (!isDatabaseAvailable) return;
			// Create a project WITHOUT configuring credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test No Credentials ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const testApiKey = createProjectResponse.body.project.testApiKey;

			// Try to create charge without credentials configured
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-no-creds-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Product',
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
				.expect(400); // Should fail because no credentials configured
		});

		it('should handle AbacatePay API errors gracefully', async () => {
			if (!isDatabaseAvailable) return;
			// Create project and configure credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test API Error ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const projectId = createProjectResponse.body.project.id;
			const testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);

			// Use invalid CPF to force AbacatePay API to reject
			const response = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-api-error-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test API Error',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
						customer: {
							name: 'Test User',
							email: 'test@example.com',
							cellphone: '+5511999999999',
							taxId: '00000000000', // Invalid CPF format
						},
					},
				})
				.expect(400);

			// Verify error response has proper structure
			expect(response.body).toBeDefined();
			// NestJS returns BadRequestException with either 'message' or 'error' field

			// Verify transaction was saved with Failed status
			const transactions = await dbService.transaction.findMany({
				where: { projectId },
			});
			expect(transactions.length).toBeGreaterThan(0);
			const failedTransaction = transactions.find(
				(t) => t.status === EPaymentStatus.Failed,
			);
			expect(failedTransaction).toBeDefined();
		});

		it('should mark webhook as Ignored when transaction does not exist', async () => {
			if (!isDatabaseAvailable) return;
			// Create project
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test Webhook Ignored ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const projectId = createProjectResponse.body.project.id;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);

			// Send webhook with non-existent externalId
			const fakeExternalId = `fake_external_${Date.now()}`;
			const webhookPayload =
				ABACATEPAY_WEBHOOK_PAYLOADS.BILLING_PAID(fakeExternalId);
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
				.expect(201); // Webhook is accepted even if transaction not found

			// Verify webhook event was created with status Ignored
			const webhookEvents = await dbService.webhookEvent.findMany({
				where: { projectId },
			});
			expect(webhookEvents.length).toBeGreaterThan(0);
			const ignoredEvent = webhookEvents.find((e) => e.status === 'Ignored');
			expect(ignoredEvent).toBeDefined();
			expect(ignoredEvent!.transactionId).toBeNull();
		});

		it('should handle BILLING_EXPIRED webhook and update transaction to Expired', async () => {
			if (!isDatabaseAvailable) return;
			// Create project and credentials
			const createProjectResponse = await request(app.getHttpServer())
				.post('/backoffice/projects')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: `Test Expired ${Date.now()}`,
					webhookUrl: webhookServer.getUrl(),
				})
				.expect(201);
			const projectId = createProjectResponse.body.project.id;
			const testApiKey = createProjectResponse.body.project.testApiKey;
			await request(app.getHttpServer())
				.post(`/backoffice/projects/${projectId}/provider-credentials`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...ABACATEPAY_CREDENTIALS,
					priority: EPriority.High,
				})
				.expect(204);

			// Create a PIX charge
			const idempotencyKey = `idem-expired-${Date.now()}`;
			const createChargeResponse = await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', testApiKey)
				.send({
					amountInCents: 10000,
					currency: ECurrency.BRL,
					idempotencyKey,
					paymentMethod: EPaymentMethod.Pix,
					isProduction: false,
					details: {
						productName: 'Test Expired',
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
			const externalId = createChargeResponse.body.transaction.externalId;

			// Verify transaction is PENDING
			let transaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(transaction!.status).toBe(EPaymentStatus.Pending);

			// Send BILLING_EXPIRED webhook
			const webhookPayload =
				ABACATEPAY_WEBHOOK_PAYLOADS.BILLING_EXPIRED(externalId);
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

			// Verify transaction was updated to EXPIRED
			transaction = await dbService.transaction.findUnique({
				where: { id: transactionId },
			});
			expect(transaction!.status).toBe(EPaymentStatus.Expired);

			// Verify webhook event was created with status Processed
			const webhookEvents = await dbService.webhookEvent.findMany({
				where: { projectId, transactionId },
			});
			expect(webhookEvents.length).toBeGreaterThan(0);
			const processedEvent = webhookEvents.find(
				(e) => e.status === 'Processed',
			);
			expect(processedEvent).toBeDefined();
		});
	});

	describe('Authentication and Security', () => {
		it('should reject charge creation with invalid API key', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.post('/charges')
				.set('x-api-key', 'invalid_key_12345')
				.send({
					amountInCents: 1000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-invalid-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					details: {
						productName: 'Test',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
					},
				})
				.expect(401);
		});

		it('should reject charge creation without API key', async () => {
			if (!isDatabaseAvailable) return;
			await request(app.getHttpServer())
				.post('/charges')
				.send({
					amountInCents: 1000,
					currency: ECurrency.BRL,
					idempotencyKey: `idem-nokey-${Date.now()}`,
					paymentMethod: EPaymentMethod.Pix,
					details: {
						productName: 'Test',
						returnUrl: 'https://example.com/return',
						completionUrl: 'https://example.com/completion',
					},
				})
				.expect(401);
		});
	});
});
