-- CreateTable
CREATE TABLE "admin_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "admin_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audits_admin_id_idx" ON "admin_audits"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audits_resource_resource_id_idx" ON "admin_audits"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "admin_audits_created_at_idx" ON "admin_audits"("created_at");

-- AddForeignKey
ALTER TABLE "admin_audits" ADD CONSTRAINT "admin_audits_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
