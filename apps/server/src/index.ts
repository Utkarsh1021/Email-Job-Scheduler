import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { RedisStore } from "connect-redis";
import { env } from "./config/env.js";
import { redis } from "./lib/redis.js";
import { configurePassport } from "./auth/passport.js";
import { authRouter } from "./routes/auth.js";
import { slackRouter } from "./routes/slack.js";
import { sendersRouter } from "./routes/senders.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { emailsRouter } from "./routes/emails.js";
import { errorHandler } from "./middleware/error.js";
import { ensureEmailIndex } from "./lib/elasticsearch.js";
import { reconcilePendingJobs } from "./lib/reconcile.js";
import { createQueueDashboard } from "./lib/bullBoard.js";

async function main() {
  configurePassport();

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(
    session({
      store: new RedisStore({ client: redis, prefix: "sess:" }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/auth/slack", slackRouter);

  const board = createQueueDashboard();
  app.use("/admin/queues", board.guard, board.router);

  app.use("/api/senders", sendersRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/emails", emailsRouter);

  app.use(errorHandler);

  try {
    await ensureEmailIndex();
  } catch (err) {
    console.warn("Elasticsearch not ready; search will fail until it is up.", err);
  }

  try {
    await reconcilePendingJobs();
  } catch (err) {
    console.warn("Reconciliation skipped", err);
  }

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
