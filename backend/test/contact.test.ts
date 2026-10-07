import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import type { Mail, Mailer } from "../src/services/mailer.js";

const valid = {
  name: "Ram Sharma",
  email: "ram@example.com",
  category: "puja",
  subject: "Rudrabhishek",
  message: "I would like to request a puja next month.",
  locale: "ne",
};

let db: Database;
let sent: Mail[];
let failMail: boolean;

function app(notifyEmail: string | null = "guru@example.com") {
  const mailer: Mailer = {
    async send(mail) {
      if (failMail) throw new Error("smtp down");
      sent.push(mail);
    },
  };
  return createApp({ db, mailer, corsOrigins: ["http://localhost:3000"], notifyEmail: notifyEmail ?? undefined });
}

// Starting PGlite is slow, so share one in-memory database and clear it per test
beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.contactMessages);
  sent = [];
  failMail = false;
});

describe("POST /api/contact", () => {
  it("saves the message and emails a notification", async () => {
    const res = await request(app()).post("/api/contact").send(valid);

    expect(res.status).toBe(201);
    const rows = await db.select().from(schema.contactMessages);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ram Sharma", category: "puja", status: "new", phone: null });
    expect(rows[0].id).toBe(res.body.id);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "guru@example.com", replyTo: "ram@example.com" });
  });

  it("rejects invalid input without saving", async () => {
    const res = await request(app())
      .post("/api/contact")
      .send({ ...valid, email: "not-an-email", category: "lottery" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["category", "email"]);
    expect(await db.select().from(schema.contactMessages)).toHaveLength(0);
  });

  it("still succeeds when the email fails to send", async () => {
    failMail = true;
    const res = await request(app()).post("/api/contact").send(valid);

    expect(res.status).toBe(201);
    expect(await db.select().from(schema.contactMessages)).toHaveLength(1);
  });

  it("skips email when no notify address is configured", async () => {
    const res = await request(app(null)).post("/api/contact").send(valid);

    expect(res.status).toBe(201);
    expect(sent).toHaveLength(0);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app())
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send("{bad");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_json");
  });
});

describe("GET /api/health", () => {
  it("responds ok", async () => {
    const res = await request(app()).get("/api/health");
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("contact rate limit", () => {
  const key = "test-internal-key-123456";
  const limited = () =>
    createApp({ db, mailer: { async send() {} }, corsOrigins: [], internalApiKey: key });

  it("limits each visitor separately when the website forwards their IP", async () => {
    const api = limited();
    const post = (ip: string, k = key) =>
      request(api).post("/api/contact").set("X-Internal-Key", k).set("X-Visitor-IP", ip).send(valid);

    for (let i = 0; i < 10; i++) expect((await post("203.0.113.1")).status).toBe(201);
    expect((await post("203.0.113.1")).status).toBe(429);
    expect((await post("203.0.113.2")).status).toBe(201);
  });

  it("ignores a forwarded IP without the right key", async () => {
    const api = limited();
    const post = (ip: string) =>
      request(api).post("/api/contact").set("X-Internal-Key", "wrong").set("X-Visitor-IP", ip).send(valid);

    for (let i = 0; i < 10; i++) expect((await post(`198.51.100.${i}`)).status).toBe(201);
    expect((await post("198.51.100.99")).status).toBe(429);
  });
});
