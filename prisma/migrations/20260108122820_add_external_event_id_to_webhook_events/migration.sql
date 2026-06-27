/*
  Warnings:

  - A unique constraint covering the columns `[provider,external_event_id]` on the table `webhook_events` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "external_event_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_event_id_key" ON "webhook_events"("provider", "external_event_id");
