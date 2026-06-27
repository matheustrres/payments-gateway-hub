# 🧪 Testes End-to-End (E2E)

Este diretório contém os testes end-to-end da aplicação Payment Gateway Hub.

## 🚀 Executando os Testes E2E

### Método Rápido (Recomendado)

```bash
# Script completo - gerencia toda infraestrutura automaticamente
./scripts/e2e-tests.sh

# Com opções
./scripts/e2e-tests.sh --verbose           # Mostra mais detalhes
./scripts/e2e-tests.sh --skip-cleanup      # Mantém containers para debug
```

### Método Manual

```bash
# Apenas rodar os testes (infraestrutura já deve estar rodando)
pnpm run test:e2e

# Ou com mais controle
pnpm run test -- tests/__e2e__
pnpm run test:e2e:watch  # Modo watch
```

## 📊 Cenários Cobertos

### ✅ AbacatePay PIX
- [x] Fluxo completo end-to-end
- [x] Idempotência
- [x] Retry de transação failed
- [x] Autenticação

### 🔄 Próximos
- [ ] Asaas Boleto/Card
- [ ] Webhook retry worker
- [ ] SQS consumer outbound

Veja detalhes completos no arquivo.
