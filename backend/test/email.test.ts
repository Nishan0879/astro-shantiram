import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import type { Mail, Mailer } from "../src/services/mailer.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;

const api = (mailer: Mailer, notifyEmail?: string) => createApp({ db, mailer, corsOrigins: [], jwtSecret, notifyEmail });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
  const [user] = await db.insert(schema.users).values({ email: "admin@example.com", name: "A", passwordHash: "x" }).returning();
  token = signToken(user.id, jwtSecret);
}, 60_000);

describe("email check", () => {
  it("says when email is not set up", async () => {
    const off: Mailer = { configured: false, async send() {} };
    expect((await as(request(api(off)).get("/api/admin/email"))).body).toEqual({ configured: false, notifyEmail: null });
    expect((await as(request(api(off)).post("/api/admin/email/test"))).status).toBe(503);
  });

  it("sends a test to the alert address, or else to the admin", async () => {
    const sent: Mail[] = [];
    const on: Mailer = { configured: true, async send(m) { sent.push(m); } };
    expect((await as(request(api(on, "guru@example.com")).post("/api/admin/email/test"))).body).toEqual({ sentTo: "guru@example.com" });
    expect((await as(request(api(on)).post("/api/admin/email/test"))).body).toEqual({ sentTo: "admin@example.com" });
    expect(sent).toHaveLength(2);
  });

  it("passes on the mail server's complaint", async () => {
    const broken: Mailer = { configured: true, async send() { throw new Error("535-5.7.8 Username and Password not accepted"); } };
    const res = await as(request(api(broken)).post("/api/admin/email/test"));
    expect(res.status).toBe(502);
    expect(res.body.detail).toContain("Username and Password not accepted");
  });
});
