#!/bin/bash

# Script completo para executar testes E2E
# Gerencia toda a infraestrutura: Postgres + LocalStack + SQS

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags de controle
SKIP_CLEANUP=false
VERBOSE=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Payment Gateway Hub - E2E Test Runner               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Função de cleanup
cleanup() {
    if [ "$SKIP_CLEANUP" = true ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Pulando cleanup (--skip-cleanup ativado)${NC}"
        echo -e "${YELLOW}   Containers ainda estão rodando para debug${NC}"
        echo ""
        echo "Para parar manualmente:"
        echo "  docker compose -f docker-compose.test.yml down"
    else
        echo ""
        echo "🧹 Limpando recursos..."
        docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
        echo -e "${GREEN}✓ Cleanup concluído${NC}"
    fi
}

# Registrar cleanup ao sair (exceto se --skip-cleanup)
trap cleanup EXIT

# Verificar dependências
echo "🔍 Verificando dependências..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Por favor, instale o Docker.${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI não encontrado. Por favor, instale o AWS CLI.${NC}"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo -e "${GREEN}✓ Dependências OK${NC}"
echo ""

# ============================================
# PASSO 1: Subir infraestrutura
# ============================================
echo -e "${BLUE}📦 PASSO 1: Subindo infraestrutura (Postgres + LocalStack)...${NC}"

# Parar containers existentes
docker compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Subir containers
docker compose -f docker-compose.test.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Falha ao subir containers${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Containers iniciados${NC}"
echo ""

# ============================================
# PASSO 2: Aguardar serviços
# ============================================
echo -e "${BLUE}⏳ PASSO 2: Aguardando serviços ficarem prontos...${NC}"

# Aguardar Postgres
echo "   - Aguardando Postgres..."
POSTGRES_READY=false
for i in {1..30}; do
    if docker compose -f docker-compose.test.yml exec -T test-database pg_isready -U matheustrres -d gateway_hub_test_db > /dev/null 2>&1; then
        POSTGRES_READY=true
        break
    fi
    sleep 1
done

if [ "$POSTGRES_READY" = false ]; then
    echo -e "${RED}❌ Postgres não ficou pronto em 30 segundos${NC}"
    echo ""
    echo "Logs do Postgres:"
    docker compose -f docker-compose.test.yml logs test-database
    exit 1
fi

echo -e "${GREEN}   ✓ Postgres pronto${NC}"

# Aguardar LocalStack
echo "   - Aguardando LocalStack..."
LOCALSTACK_READY=false
for i in {1..60}; do
    if aws --endpoint-url=http://localhost:4566 sqs list-queues > /dev/null 2>&1; then
        LOCALSTACK_READY=true
        break
    fi
    sleep 1
done

if [ "$LOCALSTACK_READY" = false ]; then
    echo -e "${RED}❌ LocalStack não ficou pronto em 60 segundos${NC}"
    echo ""
    echo "Logs do LocalStack:"
    docker compose -f docker-compose.test.yml logs test-localstack
    exit 1
fi

echo -e "${GREEN}   ✓ LocalStack pronto${NC}"
echo ""

# ============================================
# PASSO 3: Configurar LocalStack (SQS)
# ============================================
echo -e "${BLUE}🔧 PASSO 3: Configurando LocalStack (SQS)...${NC}"

# Criar fila SQS
QUEUE_NAME="webhooks-outbound-queue-test"
QUEUE_URL=$(aws --endpoint-url=http://localhost:4566 \
    sqs create-queue \
    --queue-name "$QUEUE_NAME" \
    --region us-east-1 \
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400 \
    --output text \
    --query 'QueueUrl' 2>/dev/null || echo "")

if [ -z "$QUEUE_URL" ]; then
    # Tentar obter URL da fila existente
    QUEUE_URL=$(aws --endpoint-url=http://localhost:4566 \
        sqs get-queue-url \
        --queue-name "$QUEUE_NAME" \
        --region us-east-1 \
        --output text \
        --query 'QueueUrl' 2>/dev/null || echo "")

    if [ -z "$QUEUE_URL" ]; then
        echo -e "${RED}❌ Falha ao criar/encontrar fila SQS${NC}"
        exit 1
    fi

    echo -e "${YELLOW}   ⚠️  Fila já existia, reutilizando${NC}"
else
    echo -e "${GREEN}   ✓ Fila SQS criada: $QUEUE_NAME${NC}"
fi

# Listar filas para confirmar
echo "   - Filas disponíveis:"
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1 | grep -o 'webhooks-outbound-queue-test' || echo "     (nenhuma)"

echo -e "${GREEN}✓ LocalStack configurado${NC}"
echo ""

# ============================================
# PASSO 4: Aplicar schema do banco de dados
# ============================================
echo -e "${BLUE}🗄️  PASSO 4: Aplicando schema do banco de dados...${NC}"

if pnpm run db:push:test > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Schema aplicado com sucesso${NC}"
else
    echo -e "${RED}❌ Falha ao aplicar schema do banco${NC}"
    exit 1
fi

echo ""

# ============================================
# PASSO 5: Seed do banco de dados
# ============================================
echo -e "${BLUE}🌱 PASSO 5: Seed do banco de dados (criando admin)...${NC}"

if pnpm run db:seed:test > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Seed aplicado com sucesso${NC}"
else
    echo -e "${RED}❌ Falha ao aplicar seed do banco${NC}"
    exit 1
fi

echo ""

# ============================================
# PASSO 6: Executar testes E2E
# ============================================
echo -e "${BLUE}🎯 PASSO 6: Executando testes E2E...${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Executar testes
TEST_EXIT_CODE=0

if [ "$VERBOSE" = true ]; then
    pnpm run test:e2e || TEST_EXIT_CODE=$?
else
    pnpm run test:e2e 2>&1 || TEST_EXIT_CODE=$?
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================
# Resultado Final
# ============================================
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║         ✅  TODOS OS TESTES E2E PASSARAM! 🎉              ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║              ❌  ALGUNS TESTES FALHARAM                    ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Para debugar:"
    echo "  1. Rode novamente com --skip-cleanup para manter containers rodando"
    echo "  2. Rode novamente com --verbose para ver mais detalhes"
    echo "  3. Verifique logs dos containers:"
    echo "     docker compose -f docker-compose.test.yml logs"
    echo ""
    exit 1
fi
