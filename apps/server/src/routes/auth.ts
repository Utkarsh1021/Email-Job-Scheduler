import { Router } from "express";
import passport from "passport";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { prisma } from "../lib/prisma.js";

export const authRouter = Router();

authRouter.get("/google", (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: "Google OAuth is not configured" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${env.FRONTEND_URL}/login?error=google`,
    session: true,
  }),
  (_req, res) => {
    res.redirect(`${env.FRONTEND_URL}/`);
  },
);

authRouter.get("/me", requireAuth, ah(async (req, res) => {
  const slack = await prisma.slackConnection.findUnique({
    where: { userId: req.user!.id },
  });
  res.json({
    user: req.user,
    slack: slack
      ? { connected: true, teamName: slack.teamName, channelId: slack.channelId }
      : { connected: false },
  });
}));

authRouter.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});
