import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { enqueueEmailJobs } from "../lib/queue.js";
import { bulkIndexEmails } from "../lib/elasticsearch.js";
import { randomUUID } from "node:crypto";
import { ensureDefaultSender } from "../lib/mailer.js";
import { effectiveHourlyLimit } from "../lib/quota.js";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string()).min(1).max(5000),
  startTime: z.string().min(1),
  delayMs: z.number().int().min(0),
  hourlyLimit: z.number().int().positive(),
  senderId: z.string().uuid().optional(),
});

campaignsRouter.post("/", ah(async (req, res) => {
  const input = createSchema.parse(req.body);
  const recipients = [
    ...new Set(
      input.recipients
        .map((r) => r.trim().toLowerCase())
        .filter((r) => EMAIL_RE.test(r)),
    ),
  ];
  if (recipients.length === 0) {
    res.status(400).json({ error: "No valid email addresses found" });
    return;
  }

  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) {
    res.status(400).json({ error: "Invalid startTime" });
    return;
  }
  const delayMs = Math.max(input.delayMs, env.MIN_SEND_INTERVAL_MS);

  let sender = input.senderId
    ? await prisma.sender.findFirst({
        where: { id: input.senderId, userId: req.user!.id },
      })
    : await ensureDefaultSender(req.user!.id);

  if (!sender) {
    res.status(400).json({ error: "Sender not found" });
    return;
  }

  const hourlyLimit = effectiveHourlyLimit(input.hourlyLimit, sender.hourlyLimit);

  const campaign = await prisma.campaign.create({
    data: {
      userId: req.user!.id,
      senderId: sender.id,
      subject: input.subject,
      body: input.body,
      startTime,
      delayMs,
      hourlyLimit,
    },
  });

  const emails = recipients.map((recipient, index) => {
    const id = randomUUID();
    const scheduledAt = new Date(startTime.getTime() + index * delayMs);
    return {
      id,
      campaignId: campaign.id,
      recipient,
      sequence: index,
      scheduledAt,
      jobId: "email_" + id,
      idempotencyKey: `${campaign.id}:${recipient}`,
    };
  });

  await prisma.email.createMany({ data: emails });
  await enqueueEmailJobs(
    emails.map((email) => ({
      emailId: email.id,
      jobId: email.jobId,
      runAt: email.scheduledAt,
    })),
  );
  try {
    await bulkIndexEmails(
      emails.map((email) => ({
        emailId: email.id,
        userId: req.user!.id,
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: email.recipient,
        subject: campaign.subject,
        body: campaign.body,
        status: "scheduled",
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: null,
        error: null,
      })),
    );
  } catch (err) {
    console.warn("Elasticsearch bulk index failed", err);
  }

  res.status(201).json({
    campaign: {
      id: campaign.id,
      subject: campaign.subject,
      startTime: campaign.startTime,
      delayMs: campaign.delayMs,
      hourlyLimit: campaign.hourlyLimit,
      recipientCount: emails.length,
    },
  });
}));


