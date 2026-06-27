-- AlterTable
-- Remover os índices antigos das colunas que serão renomeadas
DROP INDEX IF EXISTS "projects_api_key_hash_key";
DROP INDEX IF EXISTS "projects_api_key_prefix_key";

-- Renomear as colunas existentes para live
ALTER TABLE "projects" RENAME COLUMN "api_key_hash" TO "live_api_key_hash";
ALTER TABLE "projects" RENAME COLUMN "api_key_prefix" TO "live_api_key_prefix";

-- Criar índices únicos para as colunas renomeadas
CREATE UNIQUE INDEX "projects_live_api_key_hash_key" ON "projects"("live_api_key_hash");
CREATE UNIQUE INDEX "projects_live_api_key_prefix_key" ON "projects"("live_api_key_prefix");

-- Adicionar as novas colunas para test
ALTER TABLE "projects" ADD COLUMN "test_api_key_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "projects" ADD COLUMN "test_api_key_prefix" TEXT NOT NULL DEFAULT '';

-- Remover os defaults temporários
ALTER TABLE "projects" ALTER COLUMN "test_api_key_hash" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "test_api_key_prefix" DROP DEFAULT;

-- Criar índices únicos para as novas colunas
CREATE UNIQUE INDEX "projects_test_api_key_hash_key" ON "projects"("test_api_key_hash");
CREATE UNIQUE INDEX "projects_test_api_key_prefix_key" ON "projects"("test_api_key_prefix");

