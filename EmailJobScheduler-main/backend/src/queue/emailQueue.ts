import { Queue } from "bullmq";
import { connection } from "./connection";

export const EMAIL_QUEUE_NAME = "email-send";

export interface EmailJobData {
  scheduledEmailId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, { connection });

// Deterministic per-row jobId lets the producer, worker, and reconciler all
// agree on identity without a separate mapping table. BullMQ rejects ":" in
// custom job IDs (reserved for its own internal key namespacing), hence "-".
export function emailJobId(scheduledEmailId: string) {
  return `email-${scheduledEmailId}`;
}
