import { DelayedError, type Job, type Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { indexEmail } from "../lib/elasticsearch.js";
import { sendEmail } from "../lib/mailer.js";
import { notifyQuotaHit } from "../lib/slack.js";
import {
  delayForOverflow,
  effectiveHourlyLimit,
  tryReserveQuota,
  tryReserveSendSlot,
  releaseQuota,
} from "../lib/quota.js";
import { redis } from "../lib/redis.js";
import type { EmailJobData } from "../lib/queue.js";

export async function processEmailJob(
  job: Job<EmailJobData>,
  token: string | undefined,
) {
  const email = await prisma.email.findUnique({
    where: { id: job.data.emailId },
    include: { campaign: { include: { sender: true, user: true } } },
  });

  if (!email) {
    console.warn("Job for missing email", job.data.emailId);
    return;
  }

  if (email.status === "sent") {
    return;
  }

  if (email.status === "failed") {
    return;
  }

  const { campaign } = email;
  const { sender } = campaign;
  const minInterval = Math.max(campaign.delayMs, env.MIN_SEND_INTERVAL_MS);
  const hourlyLimit = effectiveHourlyLimit(campaign.hourlyLimit, sender.hourlyLimit);

  // Reserve hourly quota before the min-interval slot so a spill into the next
  // hour does not consume send spacing (and so other workers stay unblocked).
  const quota = await tryReserveQuota(sender.id, hourlyLimit);
  if (!quota.allowed) {
    const nextRun = delayForOverflow(email.sequence, minInterval);
    await prisma.email.update({
      where: { id: email.id },
      data: { scheduledAt: nextRun },
    });
    await job.moveToDelayed(nextRun.getTime(), token);
    throw new DelayedError();
  }

  const slot = await tryReserveSendSlot(sender.id, minInterval);
  if (!slot.allowed) {
    await releaseQuota(sender.id, quota.window);
    await job.moveToDelayed(slot.nextAt, token);
    throw new DelayedError();
  }

  if (quota.firstHit) {
    const notifyKey = `quota-notify:${sender.id}:${quota.window}`;
    const claimed = await redis.set(notifyKey, "1", "EX", 2 * 60 * 60, "NX");
    if (claimed === "OK") {
      await notifyQuotaHit({
        userId: campaign.userId,
        senderName: sender.name,
        senderId: sender.id,
        window: quota.window,
        limit: hourlyLimit,
      });
    }
  }

  const claimed = await prisma.email.updateMany({
    where: { id: email.id, status: { in: ["scheduled", "processing"] } },
    data: {
      status: "processing",
      attemptCount: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    const latest = await prisma.email.findUnique({ where: { id: email.id } });
    if (latest?.status === "sent") return;
    await releaseQuota(sender.id, quota.window);
    return;
  }

  try {
    const result = await sendEmail({
      sender,
      to: email.recipient,
      subject: campaign.subject,
      body: campaign.body,
    });

    const sentAt = new Date();
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: "sent",
        sentAt,
        previewUrl: result.previewUrl,
        error: null,
      },
    });

    await indexEmail({
      emailId: email.id,
      userId: campaign.userId,
      campaignId: campaign.id,
      senderId: sender.id,
      recipient: email.recipient,
      subject: campaign.subject,
      body: campaign.body,
      status: "sent",
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: sentAt.toISOString(),
      error: null,
    });
  } catch (err) {
    await releaseQuota(sender.id, quota.window);
    const message = err instanceof Error ? err.message : "Send failed";
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade + 1 >= attempts) {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: "failed", error: message },
      });
      await indexEmail({
        emailId: email.id,
        userId: campaign.userId,
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: email.recipient,
        subject: campaign.subject,
        body: campaign.body,
        status: "failed",
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: null,
        error: message,
      });
    } else {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: "scheduled", error: message },
      });
    }
    throw err;
  }
}

export function attachWorkerLogs(worker: Worker<EmailJobData>) {
  worker.on("completed", (job) => {
    console.log(`sent job=${job.id} email=${job.data.emailId}`);
  });
  worker.on("failed", (job, err) => {
    if (err?.name === "DelayedError" || err?.message === "DelayedError") return;
    console.error(`failed job=${job?.id}`, err.message);
  });
  worker.on("error", (err) => {
    console.error("worker error", err);
  });
}
