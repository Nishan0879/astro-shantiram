import { count, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { type User, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { hashPassword, signToken, verifyPassword } from "../services/auth.js";

export type BootstrapAdmin = { email: string; password: string; name?: string };

type Deps = {
  db: Database;
  jwtSecret?: string;
  internalApiKey?: string;
  // Signs in (and creates) the first admin while the users table is still empty
  bootstrapAdmin?: BootstrapAdmin;
};

const loginSchema = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});

export function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function authRouter({ db, jwtSecret, internalApiKey, bootstrapAdmin }: Deps) {
  const router = Router();
  const loginLimiter = visitorRateLimit({ internalApiKey, limit: 10, failuresOnly: true });
  const passwordLimiter = visitorRateLimit({ internalApiKey, limit: 10, failuresOnly: true });

  async function findOrBootstrap(email: string, password: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user) return (await verifyPassword(password, user.passwordHash)) ? user : undefined;

    if (
      !bootstrapAdmin ||
      email !== bootstrapAdmin.email.toLowerCase() ||
      password !== bootstrapAdmin.password
    ) {
      return undefined;
    }
    const [{ total }] = await db.select({ total: count() }).from(users);
    if (total > 0) return undefined;

    const [created] = await db
      .insert(users)
      .values({
        email,
        name: bootstrapAdmin.name ?? "Admin",
        passwordHash: await hashPassword(password),
        role: "super_admin",
      })
      .onConflictDoNothing()
      .returning();
    return created;
  }

  router.post("/login", loginLimiter, async (req, res) => {
    if (!jwtSecret) {
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }

    const user = await findOrBootstrap(parsed.data.email, parsed.data.password);
    if (!user) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    res.json({ token: signToken(user.id, jwtSecret), user: publicUser(user) });
  });

  router.get("/me", requireAuth(db, jwtSecret), (_req, res) => {
    res.json({ user: publicUser(res.locals.user) });
  });

  router.post("/change-password", passwordLimiter, requireAuth(db, jwtSecret), async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: z.flattenError(parsed.error).fieldErrors });
      return;
    }
    const user = res.locals.user;
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      res.status(400).json({ error: "wrong_password" });
      return;
    }

    // Signs out every other device; the caller gets a fresh token
    const now = new Date();
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.newPassword), tokensValidAfter: now })
      .where(eq(users.id, user.id));
    res.json({ token: signToken(user.id, jwtSecret!, now.getTime()) });
  });

  return router;
}
