import { z } from "zod";

export const createSenderSchema = z.object({
  displayName: z.string().min(1, "displayName is required"),
  email: z.email(),
  smtpHost: z.string().min(1, "smtpHost is required"),
  smtpPort: z.coerce.number().int().positive(),
  smtpUser: z.string().min(1, "smtpUser is required"),
  smtpPassword: z.string().min(1, "smtpPassword is required"),
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;

export const listSendersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type ListSendersQueryInput = z.infer<typeof listSendersQuerySchema>;
