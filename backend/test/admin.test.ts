import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { hashPassword, signToken, verifyToken } from "../src/services/auth.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
const bootstrapAdmin = { email: "Guru@Example.com", password: "first-password", name: "Guruji" };

let db: Database;

function app(overrides: { jwtSecret?: string } = {}) {
  return createApp({
    db,
    mailer: { async send() {} },
    corsOrigins: [],
    jwtSecret,
    bootstrapAdmin,
    ...overrides,
  });
}

async function login(api = app(), email = "guru@example.com", password = "first-password") {
  return request(api).post("/api/auth/login").send({ email, password });
}

async function token(api = app()) {
  const res = await login(api);
  expect(res.status).toBe(200);
  return res.body.token as string;
}

function message(overrides: Partial<schema.NewContactMessage> = {}): schema.NewContactMessage {
  return {
    name: "Sita",
    email: "sita@example.com",
    category: "puja",
    subject: "Puja",
    message: "Hello",
    ...overrides,
  };
}

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.contactMessages);
  await db.delete(schema.users);
});

describe("tokens", () => {
  it("round-trips and rejects tampering, other secrets and expiry", () => {
    const t = signToken("user-1", jwtSecret, 1_000_000);
    expect(verifyToken(t, jwtSecret, 1_000_000)?.sub).toBe("user-1");
    expect(verifyToken(t, "another-secret-another-secret-xx", 1_000_000)).toBeNull();
    expect(verifyToken(t.slice(0, -2) + "xx", jwtSecret, 1_000_000)).toBeNull();
    expect(verifyToken(t, jwtSecret, 1_000_000 + 8 * 24 * 3600 * 1000)).toBeNull();
  });
});

describe("POST /api/auth/login", () => {
  it("creates the first admin from the bootstrap settings", async () => {
    const res = await login(app(), "GURU@example.com");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "guru@example.com", name: "Guruji", role: "super_admin" });
    const [user] = await db.select().from(schema.users);
    expect(user.passwordHash).not.toContain("first-password");
    expect(user.lastLoginAt).not.toBeNull();
  });

  it("ignores the bootstrap settings once an admin exists", async () => {
    await db.insert(schema.users).values({
      email: "other@example.com",
      name: "Other",
      passwordHash: await hashPassword("other-password"),
    });

    expect((await login()).status).toBe(401);
    expect((await login(app(), "other@example.com", "other-password")).status).toBe(200);
  });

  it("rejects a wrong password", async () => {
    await token();
    expect((await login(app(), "guru@example.com", "wrong-password")).status).toBe(401);
  });

  it("is off until a JWT secret is configured", async () => {
    expect((await login(app({ jwtSecret: undefined }))).status).toBe(503);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password and signs out old tokens", async () => {
    const api = app();
    const old = await token(api);
    // Old tokens are cut off by the second, so make sure a second passes
    await new Promise((r) => setTimeout(r, 1100));

    const res = await request(api)
      .post("/api/auth/change-password")
      .auth(old, { type: "bearer" })
      .send({ currentPassword: "first-password", newPassword: "second-password" });

    expect(res.status).toBe(200);
    expect((await request(api).get("/api/auth/me").auth(old, { type: "bearer" })).status).toBe(401);
    expect((await request(api).get("/api/auth/me").auth(res.body.token, { type: "bearer" })).status).toBe(200);
    expect((await login(api, "guru@example.com", "second-password")).status).toBe(200);
  });

  it("requires the current password", async () => {
    const res = await request(app())
      .post("/api/auth/change-password")
      .auth(await token(), { type: "bearer" })
      .send({ currentPassword: "nope", newPassword: "second-password" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("wrong_password");
  });
});

describe("/api/admin/contact-messages", () => {
  it("requires a valid token", async () => {
    expect((await request(app()).get("/api/admin/contact-messages")).status).toBe(401);
    const res = await request(app()).get("/api/admin/contact-messages").auth("junk", { type: "bearer" });
    expect(res.status).toBe(401);
  });

  it("is for super admins only", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
      .returning();
    const res = await request(app())
      .get("/api/admin/contact-messages")
      .auth(signToken(user.id, jwtSecret), { type: "bearer" });
    expect(res.status).toBe(403);
  });

  it("lists newest first with counts, filters by status, and pages", async () => {
    const base = Date.now();
    await db.insert(schema.contactMessages).values([
      ...Array.from({ length: 21 }, (_, i) =>
        message({ subject: `New ${i}`, createdAt: new Date(base - i * 1000) }),
      ),
      message({ subject: "Done", status: "replied" }),
      message({ subject: "Buy backlinks", status: "spam", createdAt: new Date(base + 1000) }),
    ]);
    const t = await token();
    const get = (q: string) => request(app()).get(`/api/admin/contact-messages${q}`).auth(t, { type: "bearer" });

    const all = await get("");
    expect(all.body.total).toBe(22);
    expect(all.body.counts).toEqual({ new: 21, read: 0, replied: 1, archived: 0, spam: 1 });
    expect(all.body.messages).toHaveLength(20);
    // Spam stays in its own folder
    expect(all.body.messages.map((m: { subject: string }) => m.subject)).not.toContain("Buy backlinks");
    expect((await get("?status=spam")).body.messages).toMatchObject([{ subject: "Buy backlinks" }]);

    const page2 = await get("?status=new&page=2");
    expect(page2.body.total).toBe(21);
    expect(page2.body.messages.map((m: { subject: string }) => m.subject)).toEqual(["New 20"]);

    expect((await get("?status=bogus")).status).toBe(400);
  });

  it("marks a new message read when opened, updates status and deletes", async () => {
    const [m] = await db.insert(schema.contactMessages).values(message()).returning();
    const t = await token();
    const url = `/api/admin/contact-messages/${m.id}`;

    const opened = await request(app()).get(url).auth(t, { type: "bearer" });
    expect(opened.body.message).toMatchObject({ id: m.id, status: "read" });

    const patched = await request(app()).patch(url).auth(t, { type: "bearer" }).send({ status: "replied" });
    expect(patched.body.message.status).toBe("replied");
    // Opening it again keeps the status
    expect((await request(app()).get(url).auth(t, { type: "bearer" })).body.message.status).toBe("replied");

    expect((await request(app()).patch(url).auth(t, { type: "bearer" }).send({ status: "x" })).status).toBe(400);
    expect((await request(app()).delete(url).auth(t, { type: "bearer" })).status).toBe(204);
    expect((await request(app()).get(url).auth(t, { type: "bearer" })).status).toBe(404);
    expect((await request(app()).get("/api/admin/contact-messages/not-a-uuid").auth(t, { type: "bearer" })).status).toBe(404);
  });
});

describe("login rate limit", () => {
  it("blocks after 10 failed attempts but not for successful sign-ins", async () => {
    const api = app();
    for (let i = 0; i < 12; i++) expect((await login(api)).status).toBe(200);
    for (let i = 0; i < 10; i++) expect((await login(api, "guru@example.com", "wrong-password")).status).toBe(401);
    expect((await login(api)).status).toBe(429);
  });
});
