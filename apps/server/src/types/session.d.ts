import type { User } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    slackOAuthUserId?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    }
  }
}

export {};
