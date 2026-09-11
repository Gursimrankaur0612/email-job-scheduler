import { Router, type Request, type Response } from "express";
import type { EmailStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { asyncHandler, formatZodError } from "../lib/http";
import { emailJobId } from "../queue/emailQueue";
import { enqueueScheduledEmail } from "../queue/producer";
import { listQuerySchema, scheduleEmailSchema, type ListQueryInput } from "../validation/emailSchemas";

export const emailsRouter = Router();

emailsRouter.post(
  "/schedule",
  asyncHandler(async (req, res) => {
    const parsed = scheduleEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: formatZodError(parsed.error) });
    }

    const { senderId, subject, body, recipients, scheduledAt, delayBetweenEmailsMs, hourlyLimit } = parsed.data;

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      return res.status(404).json({ error: `Sender ${senderId} not found` });
    }

    // Stagger recipients by the requested delay, but never faster than the rate
    // the hourly limit allows (e.g. hourlyLimit=60 implies at least 60s apart).
    const minDelayForHourlyLimit = hourlyLimit ? Math.ceil(3_600_000 / hourlyLimit) : 0;
    const effectiveDelayMs = Math.max(delayBetweenEmailsMs, minDelayForHourlyLimit);

    const rows = recipients.map((recipient, index) => ({
      senderId,
      recipient,
      subject,
      body,
      scheduledAt: new Date(scheduledAt.getTime() + index * effectiveDelayMs),
    }));

    const scheduledEmails = await prisma.$transaction(rows.map((data) => prisma.scheduledEmail.create({ data })));

    if (effectiveDelayMs > delayBetweenEmailsMs) {
      await prisma.rateLimitEvent.create({
        data: {
          senderId,
          eventType: "hourly_limit_adjusted",
          detail: `Requested delayBetweenEmailsMs=${delayBetweenEmailsMs} increased to ${effectiveDelayMs} to respect hourlyLimit=${hourlyLimit} for ${recipients.length} recipient(s)`,
        },
      });
    }

    await Promise.all(scheduledEmails.map((row) => enqueueScheduledEmail(row)));

    // enqueueScheduledEmail persists bullmqJobId too, but the jobId is
    // deterministic so the response can reflect it without a re-fetch.
    const responseBody = scheduledEmails.map((row) => ({ ...row, bullmqJobId: emailJobId(row.id) }));

    res.status(201).json({ count: responseBody.length, scheduledEmails: responseBody });
  }),
);

async function listByStatus(
  req: Request,
  res: Response,
  status: EmailStatus,
  sortField: "scheduledAt" | "sentAt",
  defaultSortOrder: "asc" | "desc",
) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: formatZodError(parsed.error) });
  }

  const { page, pageSize, sortOrder, senderId }: ListQueryInput = parsed.data;
  const where = { status, ...(senderId ? { senderId } : {}) };

  const [total, data] = await Promise.all([
    prisma.scheduledEmail.count({ where }),
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { [sortField]: sortOrder ?? defaultSortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        // Sender identity for the detail view; SMTP credentials excluded.
        sender: { select: { id: true, displayName: true, email: true } },
      },
    }),
  ]);

  res.json({
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

emailsRouter.get(
  "/scheduled",
  asyncHandler((req, res) => listByStatus(req, res, "scheduled", "scheduledAt", "asc")),
);

emailsRouter.get(
  "/sent",
  asyncHandler((req, res) => listByStatus(req, res, "sent", "sentAt", "desc")),
);
