#!/bin/bash

# Setup LocalStack for E2E tests
# This script creates the SQS queue needed for testing

echo "🚀 Configurando LocalStack para testes E2E..."

# Wait for LocalStack to be ready
echo "⏳ Aguardando LocalStack ficar pronto..."
timeout 60 bash -c 'until aws --endpoint-url=http://localhost:4566 sqs list-queues >/dev/null 2>&1; do sleep 2; done'

if [ $? -ne 0 ]; then
  echo "❌ LocalStack não iniciou dentro de 60 segundos"
  exit 1
fi

echo "✅ LocalStack está pronto"

# Create SQS queue
echo "📬 Criando fila SQS: webhooks-outbound-queue-test"
aws --endpoint-url=http://localhost:4566 \
    sqs create-queue \
    --queue-name webhooks-outbound-queue-test \
    --region us-east-1 \
    --attributes VisibilityTimeout=30,MessageRetentionPeriod=86400

if [ $? -eq 0 ]; then
  echo "✅ Fila SQS criada com sucesso"
else
  echo "⚠️  A fila pode já existir, continuando..."
fi

# List queues to confirm
echo "📋 Filas disponíveis:"
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1

echo "✅ Setup completo para testes E2E com LocalStack!"
