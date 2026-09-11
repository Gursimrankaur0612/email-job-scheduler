import { DelayedError, Worker, type Job } from "bullmq";
import nodemailer from "nodemailer";
import { prisma } from "../db/prisma";
import { connection } from "./connection";
import { EMAIL_QUEUE_NAME, type EmailJobData } from "./emailQueue";
import { waitForSendSlot } from "./minDelay";
import { nextHourWindowStart, tryConsumeHourlySlot } from "./rateLimiter";

async function processEmailJob(job: Job<EmailJobData>, token?: string) {
  const { scheduledEmailId } = job.data;

  const row = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: { sender: true },
  });

  if (!row) {
    // Row was deleted after the job was enqueued; nothing left to send.
    return;
  }

  // Guard against double-processing: a restart's reconciliation pass and the
  // original delayed job can both end up targeting the same row in rare
  // crash-timing windows, since both are keyed by the same deterministic jobId.
  if (row.status !== "scheduled") {
    return;
  }

  const allowedToSend = await tryConsumeHourlySlot(row.senderId);
  if (!allowedToSend) {
    if (!token) {
      throw new Error(`Missing worker token for job ${job.id}; cannot reschedule`);
    }

    const rescheduledFor = nextHourWindowStart();

    await prisma.rateLimitEvent.create({
      data: {
        senderId: row.senderId,
        scheduledEmailId: row.id,
        eventType: "hourly_limit_exceeded",
        detail: `Rescheduled to ${new Date(rescheduledFor).toISOString()} — sender at MAX_EMAILS_PER_HOUR_PER_SENDER`,
      },
    });

    await job.moveToDelayed(rescheduledFor, token);

    console.log(
      `[email-worker] sender ${row.senderId} at MAX_EMAILS_PER_HOUR_PER_SENDER — ` +
        `rescheduled ${row.id} to ${new Date(rescheduledFor).toISOString()}`,
    );

    // Signals to BullMQ that this job was intentionally moved to delayed
    // rather than completed/failed; must be thrown, not returned.
    throw new DelayedError();
  }

  const transporter = nodemailer.createTransport({
    host: row.sender.smtpHost,
    port: row.sender.smtpPort,
    secure: row.sender.smtpPort === 465,
    auth: {
      user: row.sender.smtpUser,
      pass: row.sender.smtpPassword,
    },
  });

  try {
    await waitForSendSlot();

    const info = await transporter.sendMail({
      from: `"${row.sender.displayName}" <${row.sender.email}>`,
      to: row.recipient,
      subject: row.subject,
      html: row.body,
    });

    // false (not applicable, e.g. non-Ethereal SMTP) normalized to null for storage.
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { status: "sent", sentAt: new Date(), errorMessage: null, previewUrl },
    });

    console.log(`[email-worker] sent ${row.id} to ${row.recipient} — preview: ${previewUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { status: "failed", errorMessage: message },
    });

    console.error(`[email-worker] failed to send ${row.id}: ${message}`);
    // Not rethrown: the failure is recorded on the row itself, and a BullMQ
    // retry would just re-run this job to find status="failed" and no-op.
  }
}

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

export const emailWorker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection,
  concurrency,
});

emailWorker.on("failed", (job, err) => {
  console.error(`[email-worker] job ${job?.id} errored`, err);
});
