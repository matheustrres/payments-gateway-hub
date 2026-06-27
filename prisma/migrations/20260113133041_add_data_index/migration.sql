-- CreateIndex
CREATE INDEX "transaction_history_created_at_idx" ON "transaction_history"("created_at");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_success_created_at_idx" ON "webhook_delivery_logs"("success", "created_at");
