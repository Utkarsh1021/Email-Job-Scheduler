import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function currentUser(req: Request) {
  if (!req.user) {
    throw new Error("Unauthenticated");
  }
  return req.user;
}
