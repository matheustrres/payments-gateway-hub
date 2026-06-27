# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development (with watch)
pnpm start:dev

# Build
pnpm build

# Lint (auto-fix)
pnpm lint

# Format
pnpm format

# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# E2E tests (single fork)
pnpm test:e2e

# Run a specific test file
pnpm test -- tests/__unit__/modules/payments/use-cases/create-charge.use-case.spec.ts

# Run tests matching a pattern
pnpm test -- --reporter=verbose -t "CreateChargeUseCase"

# Database setup for tests
pnpm test:db:up        # starts Docker PostgreSQL for tests
pnpm db:push:test      # applies schema
pnpm db:seed:test      # seeds test data

# Run full CI test suites
pnpm test:ci           # integration
pnpm test:ci:e2e       # e2e
```

## Architecture

This is a **Payment Hub**: an abstraction layer between internal projects and multiple payment gateways (AbacatePay, Asaas). It follows Clean/Hexagonal Architecture with a Strategy Pattern for gateway selection.

### Module structure

```
src/modules/
  backoffice/    # Admin management: projects, credentials, API keys
  payments/      # Charges and subscriptions (core business)
  webhooks/      # Inbound gateway webhooks → SQS queue → delivery to projects
src/shared/      # Auth guards, DB, env, HTTP client, utilities
src/core/        # Domain primitives: Entity, ValueObject, IUseCase, enums
```

Each module follows the same internal layout:
```
application/
  use-cases/<name>/   # controller + use-case + swagger (co-located)
  dtos/               # input/output DTOs
  ports/              # interfaces for external services
  services/           # orchestrators
domain/
  entities/           # DDD entities (mutate only via methods)
  repositories/       # abstract repository interfaces
infra/
  adapters/           # gateway adapters, encryption, token, queue producers
  database/
    mappers/          # Prisma model ↔ domain entity
    repositories/     # Prisma implementations of domain repositories
  auth/               # guards
```

### Key flows

**Charge creation** (`POST /payments/charges`):
1. `CreateChargeController` → `CreateChargeUseCase`
2. Use case checks idempotency, saves `PENDING` transaction, fetches & decrypts provider credentials from DB
3. Builds flat `PaymentInput` (with `apiKey`) and passes to `PaymentOrchestratorService`
4. Orchestrator selects adapter via `switch(paymentMethod)`: Pix → AbacatePay, Boleto/Card → Asaas
5. Adapter calls external API and returns `PaymentGatewayResponse`
6. Transaction updated with gateway data; if paid, dispatched to SQS

**Inbound webhook** (`POST /webhooks/:provider`):
1. Signature verified by `WebhookSignatureGuard` (strategy per provider)
2. `ProcessInboundWebhookUseCase` routes to parser (`IWebhookParserPort`) that normalises to `NormalizedWebhookEvent`
3. For `payment` events: updates transaction status, records history, dispatches to SQS
4. For `subscription` events: delegates to `ProcessSubscriptionWebhookUseCase`
5. Failed events are retried by `WebhookRetryWorker` (scheduled); stale logs pruned by `WebhookLogsDataPruningWorker`

### Authentication

Two auth models run in parallel via `FlexibleAuthGuard`:
- **Project routes** (`/payments`, `/webhooks`): `x-api-key` header → hashed and looked up against DB. Key prefix (`test_` / `live_`) determines `isProduction` flag set on `request.project`.
- **Backoffice routes** (`/backoffice`): JWT Bearer token via `AdminAuthGuard`.

Routes opt out with `@Public()` decorator.

### Database

Prisma + PostgreSQL. Schema at `prisma/schema.prisma`. Run `prisma db push` (not migrations) for schema sync. Key models: `Project`, `ProviderCredential` (encrypted), `Transaction`, `TransactionHistory`, `Subscription`, `SubscriptionHistory`, `WebhookEvent`, `WebhookDeliveryLog`.

### Path aliases

- `@/*` → `src/*`
- `#/*` → `tests/*`

### Testing conventions

- **Framework**: Vitest (not Jest). Config at `vitest.config.mts`.
- **Test directories**: `tests/__unit__/`, `tests/__integration__/`, `tests/__e2e__/`
- **Test data**: builders in `tests/data/builders/`, in-memory mock repositories/services in `tests/data/mocks/`
- Integration and e2e tests require a running PostgreSQL (via `pnpm test:db:up`)

## Critical rules

### Gateway isolation
`CreateChargeUseCase` and controllers must **never** reference specific gateway names (AbacatePay, Asaas). All gateway selection lives in `PaymentOrchestratorService` and `SubscriptionOrchestratorService`.

### API key handling
Provider API keys are **never** read from env vars. They are fetched from `ProviderCredential` (encrypted in DB) by the use case, decrypted via `IEncryptionServicePort`, and injected into `PaymentInput.apiKey`.

### Idempotency
Every charge request requires an `idempotencyKey`. The use case checks for an existing transaction first. Transactions are saved as `PENDING` **before** the gateway call.

### Entity mutation
Domain entities (e.g. `TransactionEntity`) are only modified through their own methods (`setStatus()`, `setPaymentData()`, etc.) — never by direct property assignment.

### Axios errors in adapters
Catch Axios errors, log them, and re-throw as NestJS exceptions (`BadRequestException`, etc.). Never let Axios stack traces propagate to the HTTP response.

### Adding a new gateway
1. Implement `IPaymentGatewayPort` (or `ISubscriptionGatewayPort`) as a new adapter in `infra/adapters/payment-gateways/`
2. Register it in the module with a named provider token
3. Inject it in `PaymentOrchestratorService` and add the routing case
4. Add a credential upsert for the new provider name
