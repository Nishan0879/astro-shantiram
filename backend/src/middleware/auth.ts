import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import type { Database } from "../db/client.js";
import { type User, type UserRole, users } from "../db/schema.js";
import { verifyToken } from "../services/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      user: User;
    }
  }
}

/** Lets the request through only with a valid "Authorization: Bearer <token>". */
export function requireAuth(db: Database, jwtSecret?: string): RequestHandler {
  return async (req, res, next) => {
    if (!jwtSecret) {
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }
    const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const claims = token ? verifyToken(token, jwtSecret) : null;
    if (!claims) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, claims.sub));
    // Tokens die with their user, and with every password change
    if (!user || claims.iat < Math.floor(user.tokensValidAfter.getTime() / 1000)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.locals.user = user;
    next();
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(res.locals.user.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
