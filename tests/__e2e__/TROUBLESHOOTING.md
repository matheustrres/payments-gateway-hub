# 🔧 Troubleshooting - Testes E2E

Guia completo para resolver problemas comuns com testes E2E.

## 🚨 Problemas Comuns

### 1. Containers não sobem

**Sintoma**: Erro ao executar `docker compose up`

```bash
Error: Cannot start service test-database: driver failed programming external connectivity
```

**Solução**:
```bash
# Verificar se portas estão em uso
lsof -i :5433  # Postgres
lsof -i :4566  # LocalStack

# Matar processos se necessário
kill -9 <PID>

# Ou parar containers existentes
docker compose -f docker-compose.test.yml down -v
```

---

### 2. Postgres não fica pronto

**Sintoma**: Timeout ao aguardar Postgres

**Solução**:
```bash
# Ver logs do Postgres
docker compose -f docker-compose.test.yml logs test-database

# Verificar variáveis de ambiente
cat .env.test | grep PG_

# Tentar conectar manualmente
docker compose -f docker-compose.test.yml exec test-database \
  psql -U matheustrres -d gateway_hub_test_db

# Recriar container
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d test-database
```

---

### 3. LocalStack não responde

**Sintoma**: AWS CLI não consegue conectar

**Solução**:
```bash
# Ver logs do LocalStack
docker compose -f docker-compose.test.yml logs test-localstack

# Verificar se está escutando
curl http://localhost:4566/_localstack/health

# Testar SQS manualmente
aws --endpoint-url=http://localhost:4566 sqs list-queues

# Recriar container
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d test-localstack

# Aguardar ficar pronto (pode demorar)
sleep 10
```

---

### 4. Fila SQS não é criada

**Sintoma**: Erro ao criar fila

**Solução**:
```bash
# Verificar se LocalStack está pronto
aws --endpoint-url=http://localhost:4566 sqs list-queues

# Criar fila manualmente
aws --endpoint-url=http://localhost:4566 \
    sqs create-queue \
    --queue-name webhooks-outbound-queue-test \
    --region us-east-1

# Verificar URL da fila
aws --endpoint-url=http://localhost:4566 \
    sqs get-queue-url \
    --queue-name webhooks-outbound-queue-test
```

---

### 5. Schema do banco não aplica

**Sintoma**: Erro ao executar `pnpm run db:push:test`

**Solução**:
```bash
# Verificar conexão com banco
psql postgresql://matheustrres:3ngocwrS$@localhost:5433/gateway_hub_test_db

# Ver erros do Prisma
pnpm run db:push:test --verbose

# Resetar banco (CUIDADO: apaga tudo)
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d test-database
sleep 5
pnpm run db:push:test
```

---

### 6. Testes falham com timeout

**Sintoma**: `Error: Webhook not received within 5000ms`

**Possíveis causas**:
1. Mock server não está rodando
2. SQS consumer não está processando
3. Worker não está enviando webhook

**Solução**:
```bash
# Aumentar timeout no teste
# Em vez de: waitForWebhook(5000)
# Use: waitForWebhook(30000)

# Verificar se mock server subiu
# Procurar no log: "🌐 Mock webhook server listening on http://localhost:3001"

# Debug: rodar teste com --skip-cleanup
./scripts/e2e-tests.sh --skip-cleanup

# Verificar mensagens na fila SQS
aws --endpoint-url=http://localhost:4566 \
    sqs receive-message \
    --queue-url http://localhost:4566/000000000000/webhooks-outbound-queue-test
```

---

### 7. Credenciais inválidas (AbacatePay/Asaas)

**Sintoma**: Erro 401/403 do gateway

**Solução**:
```bash
# Verificar .env.test
cat .env.test | grep -E "ABACATEPAY|ASAAS"

# Testar credenciais manualmente
# AbacatePay
curl -X POST https://api.abacatepay.com/v1/billing/create \
  -H "Authorization: Bearer $ABACATEPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"frequency":"ONE_TIME","methods":["PIX"],"products":[{"name":"Test","price":100,"quantity":1}]}'

# Asaas
curl -X GET https://sandbox.asaas.com/api/v3/customers \
  -H "access_token: $ASAAS_API_KEY"
```

---

### 8. Memória/CPU alta durante testes

**Sintoma**: Máquina fica lenta, containers consomem muita memória

**Solução**:
```bash
# Ver consumo de recursos
docker stats

# Limitar recursos do Docker
# Editar docker-compose.test.yml:
services:
  test-database:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

# Limpar containers/volumes antigos
docker system prune -a --volumes
```

---

### 9. Erro de permissão em scripts

**Sintoma**: `Permission denied` ao executar scripts

**Solução**:
```bash
# Dar permissão de execução
chmod +x scripts/e2e-tests.sh
chmod +x scripts/setup-localstack.sh

# Ou executar com bash
bash scripts/e2e-tests.sh
```

---

### 10. Testes passam localmente mas falham no CI

**Possíveis causas**:
1. Diferenças de timezone
2. Diferenças de versão (Node, Docker)
3. Variáveis de ambiente diferentes

**Solução**:
```bash
# Garantir timezone consistente
# No teste ou no CI, definir:
export TZ=America/Sao_Paulo

# Usar mesmas versões
node --version   # deve ser a mesma do CI
docker --version

# No CI, usar cache do Docker
# .github/workflows/e2e.yml:
- uses: actions/cache@v3
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
```

---

## 🔍 Debug Avançado

### Ver logs de todos os containers

```bash
docker compose -f docker-compose.test.yml logs --follow
```

### Entrar no container para debug

```bash
# Postgres
docker compose -f docker-compose.test.yml exec test-database bash

# LocalStack
docker compose -f docker-compose.test.yml exec test-localstack bash
```

### Inspecionar fila SQS

```bash
# Ver mensagens sem remover
aws --endpoint-url=http://localhost:4566 \
    sqs receive-message \
    --queue-url http://localhost:4566/000000000000/webhooks-outbound-queue-test \
    --max-number-of-messages 10

# Purgar fila
aws --endpoint-url=http://localhost:4566 \
    sqs purge-queue \
    --queue-url http://localhost:4566/000000000000/webhooks-outbound-queue-test
```

### Inspecionar banco de dados

```bash
# Conectar ao banco
docker compose -f docker-compose.test.yml exec test-database \
  psql -U matheustrres -d gateway_hub_test_db

# Ver tabelas
\dt

# Ver dados
SELECT * FROM projects;
SELECT * FROM transactions;
SELECT * FROM webhook_events;
```

### Debug com VSCode

1. Adicionar breakpoint no teste
2. Rodar com debug:

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug E2E Tests",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["run", "test:e2e"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## 📞 Ainda com problemas?

1. Verifique os logs completos: `./scripts/e2e-tests.sh --verbose`
2. Mantenha containers rodando: `./scripts/e2e-tests.sh --skip-cleanup`
3. Abra uma issue no repositório com:
   - Logs completos
   - Versão do Node/Docker
   - Sistema operacional
   - Passos para reproduzir
