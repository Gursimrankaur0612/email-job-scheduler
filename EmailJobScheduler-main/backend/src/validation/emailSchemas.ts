import { z } from "zod";

// Accepts either a single recipient string or an array (e.g. parsed from a CSV
// upload) and normalizes both into an array for the route handler.
export const recipientsSchema = z
  .union([z.email(), z.array(z.email()).min(1, "recipients must contain at least one email")])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const scheduleEmailSchema = z.object({
  senderId: z.uuid(),
  subject: z.string().min(1, "subject is required"),
  body: z.string().min(1, "body is required"),
  recipients: recipientsSchema,
  scheduledAt: z.coerce.date(),
  delayBetweenEmailsMs: z.coerce.number().int().nonnegative().optional().default(0),
  hourlyLimit: z.coerce.number().int().positive().optional(),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  senderId: z.uuid().optional(),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;
