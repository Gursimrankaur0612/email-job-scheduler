import { prisma } from "../db/prisma";
import { emailQueue, emailJobId } from "./emailQueue";

export async function enqueueScheduledEmail(row: { id: string; scheduledAt: Date }) {
  const jobId = emailJobId(row.id);
  const delay = Math.max(row.scheduledAt.getTime() - Date.now(), 0);

  await emailQueue.add(
    "send-email",
    { scheduledEmailId: row.id },
    {
      jobId,
      delay,
      // The DB row is the source of truth for "sent"/"failed"; nothing needs
      // to read a completed job back out of BullMQ afterwards.
      removeOnComplete: true,
    },
  );

  await prisma.scheduledEmail.update({
    where: { id: row.id },
    data: { bullmqJobId: jobId },
  });
}
