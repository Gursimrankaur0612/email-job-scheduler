import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { asyncHandler, formatZodError } from "../lib/http";
import { createSenderSchema, listSendersQuerySchema } from "../validation/senderSchemas";

export const sendersRouter = Router();

// smtp_password is deliberately excluded from list responses so the credential
// isn't broadcast to every caller of a read-only listing endpoint.
const senderListSelect = {
  id: true,
  displayName: true,
  email: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SenderSelect;

sendersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSenderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: formatZodError(parsed.error) });
    }

    try {
      const sender = await prisma.sender.create({ data: parsed.data });
      res.status(201).json(sender);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ error: `Sender with email ${parsed.data.email} already exists` });
      }
      throw err;
    }
  }),
);

sendersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listSendersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: formatZodError(parsed.error) });
    }

    const { page, pageSize, sortOrder } = parsed.data;

    const [total, data] = await Promise.all([
      prisma.sender.count(),
      prisma.sender.findMany({
        select: senderListSelect,
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),
);
