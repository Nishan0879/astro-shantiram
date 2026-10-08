import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
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

  it("keeps a 10-digit phone number and rejects other lengths", async () => {
    const ok = await request(app()).post("/api/contact").send({ ...valid, phone: "+1 (817) 555-1234" });
    expect(ok.status).toBe(201);
    const [row] = await db.select().from(schema.contactMessages);
    expect(row.phone).toBe("817-555-1234");
    expect((await request(app()).post("/api/contact").send({ ...valid, phone: "" })).status).toBe(201);
    for (const phone of ["81755512", "81755512345", "28175551234"]) {
      expect((await request(app()).post("/api/contact").send({ ...valid, phone })).status).toBe(400);
    }
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

describe("spam", () => {
  it("puts link-stuffed messages in the Spam folder without emailing Guruji", async () => {
    const spammy = [
      { message: "Visit https://a.example https://b.example and https://c.example now" },
      { name: "Cheap SEO http://seo.example" },
      { message: "Great site! [url=http://x.example]click[/url]" },
      { subject: "Grow your traffic", message: "We sell backlinks and SEO, see https://seo.example" },
    ];
    for (const extra of spammy) expect((await request(app()).post("/api/contact").send({ ...valid, ...extra })).status).toBe(201);

    const rows = await db.select().from(schema.contactMessages);
    expect(rows.map((r) => r.status)).toEqual(["spam", "spam", "spam", "spam"]);
    expect(sent).toHaveLength(0);
  });

  it("lets a real message with a link through", async () => {
    await request(app())
      .post("/api/contact")
      .send({ ...valid, message: "My birth chart is at https://drive.example.com/chart, could you look at it?" });
    const [row] = await db.select().from(schema.contactMessages);
    expect(row.status).toBe("new");
    expect(sent).toHaveLength(1);
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

  it("turns away posts that do not come through the website", async () => {
    const api = limited();
    expect((await request(api).post("/api/contact").send(valid)).status).toBe(403);
    expect((await request(api).post("/api/contact").set("X-Internal-Key", "wrong").send(valid)).status).toBe(403);
    expect(await db.select().from(schema.contactMessages)).toHaveLength(0);
  });
});
