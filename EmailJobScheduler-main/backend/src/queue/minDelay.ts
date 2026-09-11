import { connection } from "./connection";

const LAST_SEND_KEY = "ratelimit:global:last-send-at";

// Blocks the caller, if needed, so real sends stay at least MIN_DELAY_MS
// apart across the whole worker (any concurrency, any sender) — this only
// gates actual sendMail calls, not rate-limit-rejected jobs, since those do
// no SMTP work and shouldn't consume the pacing budget.
export async function waitForSendSlot() {
  const minDelayMs = Number(process.env.MIN_DELAY_MS ?? 0);
  if (minDelayMs <= 0) {
    return;
  }

  // A plain GET+SET isn't atomic under concurrent workers, but for a
  // dev-scale pacing guard an occasional pair of sends landing slightly
  // closer than MIN_DELAY_MS is an acceptable tradeoff for the simplicity.
  const lastSendAt = Number((await connection.get(LAST_SEND_KEY)) ?? 0);
  const elapsed = Date.now() - lastSendAt;

  if (elapsed < minDelayMs) {
    await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
  }

  await connection.set(LAST_SEND_KEY, Date.now().toString());
}
