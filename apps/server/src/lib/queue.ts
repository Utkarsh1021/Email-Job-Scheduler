import { Queue } from "bullmq";
import { QUEUE_NAME } from "../config/env.js";
import { redisConnection } from "./redis.js";

export type EmailJobData = {
  emailId: string;
};

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function enqueueEmailJob(emailId: string, jobId: string, runAt: Date) {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  await emailQueue.add(
    "send",
    { emailId },
    {
      jobId,
      delay,
    },
  );
}

export async function enqueueEmailJobs(
  jobs: Array<{ emailId: string; jobId: string; runAt: Date }>,
) {
  const now = Date.now();
  await emailQueue.addBulk(
    jobs.map((job) => ({
      name: "send",
      data: { emailId: job.emailId },
      opts: {
        jobId: job.jobId,
        delay: Math.max(0, job.runAt.getTime() - now),
      },
    })),
  );
}
