import IORedis from "ioredis";

// BullMQ requires this on any connection used by a Queue/Worker/QueueEvents.
export const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
