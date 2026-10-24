import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { prisma } from "../lib/prisma.js";
import { ensureDefaultSender } from "../lib/mailer.js";
import { env } from "../config/env.js";

export const sendersRouter = Router();

sendersRouter.use(requireAuth);

sendersRouter.get("/", ah(async (req, res) => {
  await ensureDefaultSender(req.user!.id);
  const senders = await prisma.sender.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      fromEmail: true,
      fromName: true,
      hourlyLimit: true,
      isDefault: true,
    },
  });
  res.json({ senders, envHourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER });
}));

const createSchema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
  smtpHost: z.string().min(1).default("smtp.ethereal.email"),
  smtpPort: z.number().int().default(587),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  hourlyLimit: z.number().int().positive().optional(),
});

sendersRouter.post("/", ah(async (req, res) => {
  const body = createSchema.parse(req.body);
  const sender = await prisma.sender.create({
    data: {
      userId: req.user!.id,
      name: body.name,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpUser: body.smtpUser,
      smtpPass: body.smtpPass,
      hourlyLimit: body.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    },
  });
  res.status(201).json({
    sender: {
      id: sender.id,
      name: sender.name,
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      hourlyLimit: sender.hourlyLimit,
      isDefault: sender.isDefault,
    },
  });
}));

sendersRouter.post(
  "/ethereal",
  ah(async (req, res) => {
    const account = await nodemailer.createTestAccount();
    const count = await prisma.sender.count({ where: { userId: req.user!.id } });
    const sender = await prisma.sender.create({
      data: {
        userId: req.user!.id,
        name: `Ethereal ${count + 1}`,
        fromName: `Outbox ${count + 1}`,
        fromEmail: account.user,
        smtpHost: env.ETHEREAL_HOST,
        smtpPort: env.ETHEREAL_PORT,
        smtpUser: account.user,
        smtpPass: account.pass,
        hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        isDefault: false,
      },
    });
    res.status(201).json({
      sender: {
        id: sender.id,
        name: sender.name,
        fromEmail: sender.fromEmail,
        fromName: sender.fromName,
        hourlyLimit: sender.hourlyLimit,
        isDefault: sender.isDefault,
      },
    });
  }),
);
