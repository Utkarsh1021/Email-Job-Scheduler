import { prisma } from "./prisma.js";
import { emailQueue, enqueueEmailJob } from "./queue.js";

const STALE_PROCESSING_MS = 5 * 60 * 1000;

export async function reconcilePendingJobs() {
  const now = Date.now();
  const staleBefore = new Date(now - STALE_PROCESSING_MS);

  await prisma.email.updateMany({
    where: { status: "processing", updatedAt: { lt: staleBefore } },
    data: { status: "scheduled" },
  });

  const pending = await prisma.email.findMany({
    where: { status: { in: ["scheduled", "processing"] } },
  });

  let recovered = 0;
  for (const email of pending) {
    const existing = await emailQueue.getJob(email.jobId);
    if (existing) {
      const state = await existing.getState();
      // completed + still scheduled is the SMTP/DB crash window — do not
      // automatically re-send (see README). Failed queue jobs with a
      // still-pending DB row can be safely re-queued after removing the stub.
      if (state === "failed") {
        await existing.remove();
      } else {
        continue;
      }
    }
    await enqueueEmailJob(email.id, email.jobId, email.scheduledAt);
    recovered += 1;
  }

  console.log(`Reconciliation complete. pending=${pending.length} requeued=${recovered}`);
  return { pending: pending.length, recovered };
}
