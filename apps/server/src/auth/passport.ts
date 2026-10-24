import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ensureDefaultSender } from "../lib/mailer.js";

export function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        done(null, false);
        return;
      }
      done(null, {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } catch (err) {
      done(err);
    }
  });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.warn("GOOGLE_CLIENT_ID/SECRET missing — Google login will fail until configured.");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            done(new Error("Google profile has no email"));
            return;
          }
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              email,
              name: profile.displayName || email,
              avatarUrl: profile.photos?.[0]?.value ?? null,
            },
            update: {
              email,
              name: profile.displayName || email,
              avatarUrl: profile.photos?.[0]?.value ?? null,
            },
          });
          await ensureDefaultSender(user.id);
          done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          });
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}
