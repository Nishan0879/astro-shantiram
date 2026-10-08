import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { hashPassword, signToken } from "../src/services/auth.js";
import type { Mail } from "../src/services/mailer.js";
import { newsletterKey } from "../src/services/newsletter.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
const internalApiKey = "internal-key-for-tests";
const cronSecret = "cron-secret-for-tests";

let db: Database;
let sent: Mail[];
let failFor: string | null;
const api = () =>
  createApp({
    db,
    mailer: {
      configured: true,
      async send(m) {
        if (m.to === failFor) throw new Error("mailbox full");
        sent.push(m);
      },
    },
    corsOrigins: [],
    jwtSecret,
    internalApiKey,
    cronSecret,
    siteUrl: "https://example.org",
  });
const subscribe = (email: string, locale = "en") =>
  request(api()).post("/api/newsletter/subscribe").set("x-internal-key", internalApiKey).send({ email, locale });
const confirm = (email: string) =>
  request(api()).post("/api/newsletter/confirm").send({ email, key: newsletterKey(jwtSecret, "confirm", email) });
const linkIn = (mail: Mail) => mail.text.match(/https:\/\/example\.org\/\S+/)![0];

let admin: string;
const asAdmin = (req: request.Test) => req.set("Authorization", `Bearer ${admin}`);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  sent = [];
  failFor = null;
  await db.delete(schema.newsletterIssues);
  await db.delete(schema.newsletterSubscribers);
  await db.delete(schema.users);
  const [user] = await db
    .insert(schema.users)
    .values({ email: "guru@example.com", name: "Guruji", role: "guru", passwordHash: await hashPassword("password-123") })
    .returning();
  admin = signToken(user.id, jwtSecret);
});

describe("signing up", () => {
  it("asks the person to confirm before adding them", async () => {
    expect((await subscribe("Sita@Example.com", "ne")).status).toBe(202);
    const [row] = await db.select().from(schema.newsletterSubscribers);
    expect(row).toMatchObject({ email: "sita@example.com", status: "pending", locale: "ne" });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("पुष्टि");
    const link = new URL(linkIn(sent[0]));
    expect(link.pathname).toBe("/ne/newsletter");
    expect(link.searchParams.get("email")).toBe("sita@example.com");

    const res = await request(api()).post("/api/newsletter/confirm").send({ email: "sita@example.com", key: link.searchParams.get("key") });
    expect(res.body).toEqual({ status: "subscribed" });
    const [confirmed] = await db.select().from(schema.newsletterSubscribers);
    expect(confirmed.confirmedAt).toBeTruthy();
  });

  it("does not let anyone confirm or remove an address without its key", async () => {
    await subscribe("sita@example.com");
    expect((await request(api()).post("/api/newsletter/confirm").send({ email: "sita@example.com", key: "x".repeat(32) })).status).toBe(404);
    expect((await request(api()).post("/api/newsletter/unsubscribe").send({ email: "sita@example.com", key: newsletterKey(jwtSecret, "confirm", "sita@example.com") })).status).toBe(404);
  });

  it("gives the same answer for people already on the list, without emailing them again", async () => {
    await subscribe("sita@example.com");
    await confirm("sita@example.com");
    sent = [];
    expect((await subscribe("sita@example.com")).status).toBe(202);
    expect(sent).toHaveLength(0);
  });

  it("only takes sign-ups through the website and checks the email", async () => {
    expect((await request(api()).post("/api/newsletter/subscribe").send({ email: "a@example.com" })).status).toBe(403);
    expect((await subscribe("not-an-email")).status).toBe(400);
  });
});

describe("sending an update", () => {
  async function people(...emails: string[]) {
    for (const e of emails) {
      await subscribe(e);
      await confirm(e);
    }
    sent = [];
  }

  it("emails confirmed subscribers a few at a time, each with their own unsubscribe link", async () => {
    await people(...Array.from({ length: 12 }, (_, i) => `person${i}@example.com`));
    await subscribe("pending@example.com");
    sent = [];

    const created = await asAdmin(request(api()).post("/api/admin/newsletter/issues")).send({ subject: "Dashain blessings", body: "Namaste,\n\nDashain starts soon." });
    expect(created.status).toBe(201);
    const id = created.body.issue.id;

    const test = await asAdmin(request(api()).post(`/api/admin/newsletter/issues/${id}/test`));
    expect(test.body).toEqual({ sentTo: "guru@example.com" });
    expect(sent[0].subject).toBe("[Test] Dashain blessings");
    sent = [];

    const first = await asAdmin(request(api()).post(`/api/admin/newsletter/issues/${id}/send`));
    expect(first.body).toMatchObject({ sent: 10, remaining: 2, issue: { status: "sending", recipientCount: 12 } });
    // A draft that is sending can no longer be changed
    expect((await asAdmin(request(api()).put(`/api/admin/newsletter/issues/${id}`)).send({ subject: "x", body: "y" })).status).toBe(409);

    const second = await asAdmin(request(api()).post(`/api/admin/newsletter/issues/${id}/send`));
    expect(second.body).toMatchObject({ sent: 12, remaining: 0, issue: { status: "sent", sentCount: 12 } });
    expect(sent).toHaveLength(12);
    expect(new Set(sent.map((m) => m.to)).size).toBe(12);
    expect(sent.map((m) => m.to)).not.toContain("pending@example.com");

    const mail = sent.find((m) => m.to === "person3@example.com")!;
    expect(mail.text).toContain("Dashain starts soon.");
    const unsubscribe = new URL(linkIn(mail));
    expect(unsubscribe.searchParams.get("unsubscribe")).toBe("1");
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // Sending again does nothing
    await asAdmin(request(api()).post(`/api/admin/newsletter/issues/${id}/send`));
    expect(sent).toHaveLength(12);

    // Their unsubscribe link works, including a mail app's one-click button
    const res = await request(api())
      .post("/api/newsletter/unsubscribe")
      .send({ email: "person3@example.com", key: unsubscribe.searchParams.get("key") });
    expect(res.body).toEqual({ status: "unsubscribed" });
    const oneClick = new URL(mail.headers!["List-Unsubscribe"].slice(1, -1));
    expect(oneClick.pathname).toBe("/api/newsletter/unsubscribe");

    const overview = await asAdmin(request(api()).get("/api/admin/newsletter"));
    expect(overview.body.counts).toEqual({ pending: 1, subscribed: 11, unsubscribed: 1 });
  });

  it("skips people who left after it was queued, records failures, and the daily job finishes the rest", async () => {
    await people("a@example.com", "b@example.com", "c@example.com");
    const { body } = await asAdmin(request(api()).post("/api/admin/newsletter/issues")).send({ subject: "Puja", body: "Hello" });
    const id = body.issue.id;
    await db.update(schema.newsletterIssues).set({ status: "sending" }).where(eq(schema.newsletterIssues.id, id));
    // Queue by hand, as the send button does, then let the daily job do the sending
    const subs = await db.select().from(schema.newsletterSubscribers);
    await db.insert(schema.newsletterDeliveries).values(subs.map((s) => ({ issueId: id, subscriberId: s.id })));
    await request(api())
      .post("/api/newsletter/unsubscribe")
      .send({ email: "b@example.com", key: newsletterKey(jwtSecret, "unsubscribe", "b@example.com") });
    failFor = "c@example.com";

    const cron = await request(api()).get("/api/cron/newsletter").set("Authorization", `Bearer ${cronSecret}`);
    expect(cron.body.issues).toEqual([{ id, status: "sent", remaining: 0 }]);
    expect(sent.map((m) => m.to)).toEqual(["a@example.com"]);
    const detail = await asAdmin(request(api()).get(`/api/admin/newsletter/issues/${id}`));
    expect(detail.body).toMatchObject({ sent: 1, failed: 1, issue: { sentCount: 1 } });
  });

  it("checks the fields and only lets content editors in", async () => {
    const res = await asAdmin(request(api()).post("/api/admin/newsletter/issues")).send({ subject: "", body: "" });
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["body", "subject"]);
    expect((await request(api()).get("/api/admin/newsletter")).status).toBe(401);
  });
});
