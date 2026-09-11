-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('scheduled', 'sent', 'failed');

-- CreateTable
CREATE TABLE "senders" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT NOT NULL,
    "smtp_password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_emails" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'scheduled',
    "bullmq_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "scheduled_email_id" TEXT,
    "event_type" TEXT NOT NULL,
    "detail" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "senders_email_key" ON "senders"("email");

-- CreateIndex
CREATE INDEX "scheduled_emails_status_scheduled_at_idx" ON "scheduled_emails"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_emails_status_sent_at_idx" ON "scheduled_emails"("status", "sent_at");

-- CreateIndex
CREATE INDEX "scheduled_emails_sender_id_idx" ON "scheduled_emails"("sender_id");

-- CreateIndex
CREATE INDEX "rate_limit_events_sender_id_occurred_at_idx" ON "rate_limit_events"("sender_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_scheduled_email_id_fkey" FOREIGN KEY ("scheduled_email_id") REFERENCES "scheduled_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;
