import "dotenv/config";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "../src/db/prisma";
import { connection } from "../src/queue/connection";
import { emailQueue } from "../src/queue/emailQueue";
import { enqueueScheduledEmail } from "../src/queue/producer";
import { emailWorker } from "../src/queue/worker";

// Usage: npm run loadtest -- [--count=1000] [--senders=5] [--wait-ms=30000]
function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([\w-]+)=(.*)$/.exec(arg);
    if (match) args.set(match[1], match[2]);
  }
  return {
    count: Number(args.get("count") ?? 1000),
    numSenders: Number(args.get("senders") ?? 5),
    waitMs: Number(args.get("wait-ms") ?? 30_000),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTestSenders(count: number) {
  console.log(`Creating ${count} Ethereal test sender(s)...`);
  const accounts = await Promise.all(Array.from({ length: count }, () => nodemailer.createTestAccount()));

  return Promise.all(
    accounts.map((account, i) =>
      prisma.sender.create({
        data: {
          displayName: `Load Test Sender ${i + 1}`,
          email: account.user,
          smtpHost: account.smtp.host,
          smtpPort: account.smtp.port,
          smtpUser: account.user,
          smtpPassword: account.pass,
        },
      }),
    ),
  );
}

async function main() {
  const { count, numSenders, waitMs } = parseArgs();
  const hourlyLimit = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 100);
  const minDelayMs = Number(process.env.MIN_DELAY_MS ?? 0);
  const workerConcurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

  console.log(`=== Load test: ${count} emails across ${numSenders} sender(s) ===`);
  console.log(
    `MAX_EMAILS_PER_HOUR_PER_SENDER=${hourlyLimit}  MIN_DELAY_MS=${minDelayMs}  WORKER_CONCURRENCY=${workerConcurrency}\n`,
  );

  const senders = await createTestSenders(numSenders);
  console.log(`Created senders: ${senders.map((s) => s.email).join(", ")}\n`);

  // All rows target roughly the same instant, so every sender's requests
  // land in the same hour window and the rate limiter actually gets exercised.
  const scheduledAt = new Date(Date.now() + 3000);

  const rows = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    senderId: senders[i % senders.length].id,
    recipient: `loadtest+${i}@example.com`,
    subject: `Load test email #${i}`,
    body: "Load test message body.",
    scheduledAt,
  }));

  console.log(`Inserting ${rows.length} scheduled_emails row(s)...`);
  await prisma.scheduledEmail.createMany({ data: rows });

  console.log(`Enqueuing ${rows.length} BullMQ job(s)...`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((row) => enqueueScheduledEmail(row)));
    process.stdout.write(`  enqueued ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`\nAll ${rows.length} jobs enqueued.\n`);

  const testIds = rows.map((r) => r.id);

  console.log(`Waiting up to ${Math.round(waitMs / 1000)}s for jobs to settle (polling every 2s)...\n`);

  const start = Date.now();
  let lastKey = "";
  let final = { sent: 0, failed: 0, scheduled: 0, rateLimited: 0 };

  while (Date.now() - start < waitMs) {
    const [sent, failed, scheduled, rateLimitedRows] = await Promise.all([
      prisma.scheduledEmail.count({ where: { id: { in: testIds }, status: "sent" } }),
      prisma.scheduledEmail.count({ where: { id: { in: testIds }, status: "failed" } }),
      prisma.scheduledEmail.count({ where: { id: { in: testIds }, status: "scheduled" } }),
      prisma.rateLimitEvent.findMany({
        where: { scheduledEmailId: { in: testIds }, eventType: "hourly_limit_exceeded" },
        select: { scheduledEmailId: true },
        distinct: ["scheduledEmailId"],
      }),
    ]);

    const rateLimited = rateLimitedRows.length;
    final = { sent, failed, scheduled, rateLimited };

    const key = `${sent}:${failed}:${scheduled}:${rateLimited}`;
    if (key !== lastKey) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(
        `[t+${elapsed}s] sent=${sent} failed=${failed} still-scheduled=${scheduled}  ` +
          `(of which ${rateLimited} rate-limited & rescheduled at least once)`,
      );
      lastKey = key;
    }

    if (sent + failed === testIds.length) {
      break;
    }

    await sleep(2000);
  }

  const accountedFor = final.sent + final.failed + final.scheduled;

  console.log("\n=== Results ===");
  console.log(`sent:                        ${final.sent}`);
  console.log(`failed:                      ${final.failed}`);
  console.log(`still scheduled (in queue):  ${final.scheduled}`);
  console.log(`  of which rate-limited & rescheduled at least once: ${final.rateLimited}`);
  console.log("---------------------------------------");
  console.log(
    `accounted for: ${accountedFor} / ${testIds.length}` +
      (accountedFor === testIds.length ? "  ✓ nothing dropped" : "  ✗ MISMATCH — see warning below"),
  );

  if (accountedFor !== testIds.length) {
    console.error(
      `WARNING: expected ${testIds.length} rows total, only accounted for ${accountedFor} — some rows may be missing.`,
    );
  }

  if (final.scheduled > 0) {
    console.log(
      `\n${final.scheduled} row(s) are still "scheduled" — either not yet dispatched, or rate-limited and ` +
        "waiting for their sender's next hour window. Run this script again with a larger --wait-ms, or query " +
        "the DB directly, to watch them resolve.",
    );
  }

  console.log(`\nTest sender IDs (for cleanup): ${senders.map((s) => s.id).join(", ")}`);
  console.log("To remove this run's test data:");
  console.log(`  DELETE FROM scheduled_emails WHERE sender_id IN (${senders.map((s) => `'${s.id}'`).join(", ")});`);
  console.log(`  DELETE FROM senders WHERE id IN (${senders.map((s) => `'${s.id}'`).join(", ")});`);

  await emailWorker.close();
  await emailQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
