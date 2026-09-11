import { prisma } from "../db/prisma";
import { emailQueue, emailJobId } from "./emailQueue";

// Runs once at startup: covers the case where a row is still "scheduled" in
// Postgres but its BullMQ job is gone from Redis (e.g. Redis data loss, or
// the job was never successfully enqueued before a crash).
export async function reconcileScheduledJobs() {
  const scheduledRows = await prisma.scheduledEmail.findMany({
    where: { status: "scheduled" },
    select: { id: true, scheduledAt: true },
  });

  let requeued = 0;

  for (const row of scheduledRows) {
    const jobId = emailJobId(row.id);
    const existingJob = await emailQueue.getJob(jobId);

    if (existingJob) {
      continue;
    }

    const delay = Math.max(row.scheduledAt.getTime() - Date.now(), 0);

    await emailQueue.add(
      "send-email",
      { scheduledEmailId: row.id },
      { jobId, delay, removeOnComplete: true },
    );

    await prisma.scheduledEmail.update({
      where: { id: row.id },
      data: { bullmqJobId: jobId },
    });

    requeued++;
  }

  if (requeued > 0) {
    console.log(`[reconcile] re-added ${requeued} missing job(s) for scheduled emails`);
  }

  return requeued;
}
