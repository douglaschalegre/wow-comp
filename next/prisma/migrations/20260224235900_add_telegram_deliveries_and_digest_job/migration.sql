-- AlterEnum
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'DIGEST';

-- CreateEnum
CREATE TYPE "TelegramDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TelegramMessageType" AS ENUM ('DAILY_DIGEST');

-- CreateTable
CREATE TABLE "telegram_deliveries" (
    "id" TEXT NOT NULL,
    "job_run_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "message_type" "TelegramMessageType" NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "message_text" TEXT NOT NULL,
    "telegram_message_id" TEXT,
    "status" "TelegramDeliveryStatus" NOT NULL,
    "sent_at" TIMESTAMP(3),
    "error_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_deliveries_daily_unique" ON "telegram_deliveries"("chat_id", "message_type", "delivery_date");

-- CreateIndex
CREATE INDEX "telegram_deliveries_delivery_date_idx" ON "telegram_deliveries"("delivery_date");

-- CreateIndex
CREATE INDEX "telegram_deliveries_status_idx" ON "telegram_deliveries"("status");

-- CreateIndex
CREATE INDEX "telegram_deliveries_job_run_id_idx" ON "telegram_deliveries"("job_run_id");

-- AddForeignKey
ALTER TABLE "telegram_deliveries" ADD CONSTRAINT "telegram_deliveries_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
