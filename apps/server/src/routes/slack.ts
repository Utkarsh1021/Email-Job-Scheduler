import { Router } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { prisma } from "../lib/prisma.js";
import { slackAuthorizeUrl, exchangeSlackCode, upsertSlackConnection } from "../lib/slack.js";

export const slackRouter = Router();

slackRouter.get("/status", requireAuth, ah(async (req, res) => {
  const slack = await prisma.slackConnection.findUnique({
    where: { userId: req.user!.id },
  });
  res.json(
    slack
      ? { connected: true, teamName: slack.teamName, channelId: slack.channelId }
      : { connected: false },
  );
}));

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!env.SLACK_CLIENT_ID) {
    res.status(500).json({ error: "Slack OAuth is not configured" });
    return;
  }
  req.session.slackOAuthUserId = req.user!.id;
  const state = crypto.randomBytes(16).toString("hex");
  req.session.save(() => {
    res.redirect(slackAuthorizeUrl(state));
  });
});

slackRouter.get("/callback", ah(async (req, res) => {
  const userId = req.session.slackOAuthUserId || req.user?.id;
  if (!userId) {
    res.redirect(`${env.FRONTEND_URL}/?slack=unauthenticated`);
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    res.redirect(`${env.FRONTEND_URL}/?slack=denied`);
    return;
  }
  try {
    const data = await exchangeSlackCode(code);
    await upsertSlackConnection(userId, data);
    delete req.session.slackOAuthUserId;
    res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${env.FRONTEND_URL}/?slack=error`);
  }
}));

slackRouter.delete(
  "/",
  requireAuth,
  ah(async (req, res) => {
    await prisma.slackConnection.deleteMany({ where: { userId: req.user!.id } });
    res.json({ ok: true });
  }),
);
