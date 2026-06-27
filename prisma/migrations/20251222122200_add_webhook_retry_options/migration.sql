-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_retry_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_attempts_idx" ON "webhook_events"("status", "next_retry_at", "attempts");
