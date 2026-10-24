import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queue.js";
import type { RequestHandler } from "express";
import { requireAuth } from "../middleware/auth.js";

export function createQueueDashboard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });
  return {
    router: serverAdapter.getRouter() as RequestHandler,
    guard: requireAuth,
  };
}
