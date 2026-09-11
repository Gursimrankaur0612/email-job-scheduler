import { connection } from "./connection";

const HOUR_MS = 3_600_000;

function hourlyKey(senderId: string, windowStart: number) {
  return `ratelimit:${senderId}:${windowStart}`;
}

export function currentHourWindowStart(now = Date.now()) {
  return Math.floor(now / HOUR_MS) * HOUR_MS;
}

export function nextHourWindowStart(now = Date.now()) {
  return currentHourWindowStart(now) + HOUR_MS;
}

// INCR + EXPIRE fixed-window counter, keyed by sender:hourWindow. Returns true
// if this send may proceed (a slot was claimed for the current hour), false
// if the sender is already at or over MAX_EMAILS_PER_HOUR_PER_SENDER.
export async function tryConsumeHourlySlot(senderId: string): Promise<boolean> {
  const limit = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 100);
  const key = hourlyKey(senderId, currentHourWindowStart());

  const count = await connection.incr(key);
  // Re-set on every call, not just count===1: if a prior process crashed
  // between INCR and EXPIRE on the first hit, the key would otherwise never
  // expire. Re-setting here is self-healing against that lost EXPIRE.
  await connection.expire(key, 3600);

  if (count > limit) {
    // Give back the slot this rejected attempt claimed, so it doesn't count
    // against the sender's real throughput for the rest of the window.
    await connection.decr(key);
    return false;
  }

  return true;
}
