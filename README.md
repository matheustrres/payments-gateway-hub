# Payments Gateway Hub

## Clonagem e Instalação

```bash
# Clone o repositório
git clone <conexão>
cd payments-gateway-hub

# Instale as depend�ncias
pnpm install
```

## Configuração

```bash
# Copie o arquivo de exemplo das variáveis de ambiente
cp .env.sample .env
cp .env.sample .env.dev
cp .env.sample .env.test
cp .env.sample .env.staging

# Configure as variáveis de ambiente nos arquivos criados
```

## Execução

```bash
# Desenvolvimento sem watch
pnpm start

# Desenvolvimento com watch
pnpm start:dev

# Produção
pnpm start:prod

# Staging
pnpm start:staging
```

## Testes

```bash
# Executar testes
pnpm test

# Testes com watch
pnpm test:watch

# Testes com cobertura
pnpm test:cov
```

## Lint

```bash
# Rodar eslint
pnpm lint

# Rodar prettier
pnpm format

# O Husky já fica responsável por rodar o lint-staged, que executa os comandos acima, como pré commit.
```