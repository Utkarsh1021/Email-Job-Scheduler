import { Worker } from "bullmq";
import { env, QUEUE_NAME } from "./config/env.js";
import { redisConnection } from "./lib/redis.js";
import { processEmailJob, attachWorkerLogs } from "./worker/processor.js";
import { ensureEmailIndex } from "./lib/elasticsearch.js";
import { reconcilePendingJobs } from "./lib/reconcile.js";
import type { EmailJobData } from "./lib/queue.js";

async function main() {
  try {
    await ensureEmailIndex();
  } catch (err) {
    console.warn("Elasticsearch not ready", err);
  }

  try {
    await reconcilePendingJobs();
  } catch (err) {
    console.warn("Reconciliation skipped", err);
  }

  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job, token) => processEmailJob(job, token),
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  attachWorkerLogs(worker);
  console.log(
    `Worker started concurrency=${env.WORKER_CONCURRENCY} minInterval=${env.MIN_SEND_INTERVAL_MS}ms hourly=${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/sender`,
  );

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
