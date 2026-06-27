#!/bin/bash

# Script completo para executar testes de Integração
# Gerencia a infraestrutura: Postgres

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
echo -e "${BLUE}║    Payment Gateway Hub - Integration Test Runner         ║${NC}"
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

echo -e "${GREEN}✓ Dependências OK${NC}"
echo ""

# ============================================
# PASSO 1: Subir infraestrutura
# ============================================
echo -e "${BLUE}📦 PASSO 1: Subindo infraestrutura (Postgres)...${NC}"

# Parar containers existentes
docker compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Subir apenas o Postgres
docker compose -f docker-compose.test.yml up -d test-database

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Falha ao subir containers${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Containers iniciados${NC}"
echo ""

# ============================================
# PASSO 2: Aguardar Postgres
# ============================================
echo -e "${BLUE}⏳ PASSO 2: Aguardando Postgres ficar pronto...${NC}"

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

echo -e "${GREEN}✓ Postgres pronto${NC}"
echo ""

# ============================================
# PASSO 3: Limpar e recriar banco de dados
# ============================================
echo -e "${BLUE}🗑️  PASSO 3: Limpando banco de dados...${NC}"

# Drop and recreate database to ensure clean state
docker compose -f docker-compose.test.yml exec -T test-database psql -U matheustrres -d postgres -c "DROP DATABASE IF EXISTS gateway_hub_test_db;" > /dev/null 2>&1 || true
docker compose -f docker-compose.test.yml exec -T test-database psql -U matheustrres -d postgres -c "CREATE DATABASE gateway_hub_test_db;" > /dev/null 2>&1

echo -e "${GREEN}✓ Banco de dados limpo${NC}"
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
# PASSO 5: Executar testes de Integração
# ============================================
echo -e "${BLUE}🎯 PASSO 5: Executando testes de Integração...${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Executar testes
TEST_EXIT_CODE=0

if [ "$VERBOSE" = true ]; then
    pnpm run test:integration || TEST_EXIT_CODE=$?
else
    pnpm run test:integration 2>&1 || TEST_EXIT_CODE=$?
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
    echo -e "${GREEN}║    ✅  TODOS OS TESTES DE INTEGRAÇÃO PASSARAM! 🎉        ║${NC}"
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
    echo "     docker compose -f docker-compose.test.yml logs test-database"
    echo ""
    exit 1
fi