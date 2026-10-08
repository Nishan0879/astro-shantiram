import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { hashPassword, signToken } from "../src/services/auth.js";
import type { Mail } from "../src/services/mailer.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
const internalApiKey = "internal-key-for-tests";
const review = {
  name: "Sita Sharma",
  place: "Irving, TX",
  email: "sita@example.com",
  rating: 5,
  service: "Kundali reading",
  message: "Guruji explained my chart patiently and the advice really helped my family.",
  locale: "en",
};

let db: Database;
let sent: Mail[];
const api = () =>
  createApp({ db, mailer: { async send(m) { sent.push(m); } }, corsOrigins: [], jwtSecret, internalApiKey, notifyEmail: "guru@example.com" });
const send = (body: object, key = internalApiKey) => request(api()).post("/api/testimonials").set("x-internal-key", key).send(body);

async function tokenFor(role: schema.UserRole) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${role}@example.com`, name: role, role, passwordHash: await hashPassword("password-123") })
    .returning();
  return signToken(user.id, jwtSecret);
}

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  sent = [];
  await db.delete(schema.testimonials);
  await db.delete(schema.users);
});

describe("POST /api/testimonials", () => {
  it("saves a review to wait for approval and tells Guruji", async () => {
    const res = await send(review);
    expect(res.status).toBe(201);
    const [row] = await db.select().from(schema.testimonials);
    expect(row).toMatchObject({ name: "Sita Sharma", rating: 5, status: "new", featured: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "guru@example.com", replyTo: "sita@example.com" });
    expect(sent[0].text).toContain("only after you approve it");

    // Not on the site yet
    expect((await request(api()).get("/api/testimonials")).body).toMatchObject({ testimonials: [], count: 0, average: null });
  });

  it("checks the fields", async () => {
    const res = await send({ ...review, rating: 0, message: "ok", email: "nope" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["email", "message", "rating"]);
  });

  it("only takes reviews through the website", async () => {
    expect((await send(review, "wrong")).status).toBe(403);
  });

  it("puts advertising in spam without emailing", async () => {
    await send({ ...review, message: "Best SEO backlinks here https://seo.example https://a.example https://b.example" });
    const [row] = await db.select().from(schema.testimonials);
    expect(row.status).toBe("spam");
    expect(sent).toHaveLength(0);
  });
});

describe("approving reviews", () => {
  it("shows approved reviews, featured first, without emails", async () => {
    const editor = await tokenFor("content_admin");
    await send(review);
    await send({ ...review, name: "Ram", rating: 4, message: "A very peaceful Satyanarayan puja at our home in Plano." });
    await send({ ...review, name: "Hari", rating: 1, message: "Not shown because it is never approved by Guruji." });
    const rows = await db.select().from(schema.testimonials);
    const byName = (n: string) => rows.find((r) => r.name === n)!;
    const patch = (id: string, body: object) =>
      request(api()).patch(`/api/admin/testimonials/${id}`).set("Authorization", `Bearer ${editor}`).send(body);

    expect((await patch(byName("Sita Sharma").id, { status: "approved" })).body.testimonial.approvedAt).toBeTruthy();
    await patch(byName("Ram").id, { status: "approved" });
    await patch(byName("Ram").id, { featured: true, name: "Ram K." });

    const list = await request(api()).get("/api/testimonials");
    expect(list.body.count).toBe(2);
    expect(list.body.average).toBe(4.5);
    expect(list.body.testimonials.map((t: { name: string }) => t.name)).toEqual(["Ram K.", "Sita Sharma"]);
    // Approving and featuring leave the other details alone
    expect(list.body.testimonials[1]).toMatchObject({ place: "Irving, TX", service: "Kundali reading" });
    expect((await patch(byName("Sita Sharma").id, { place: "" })).body.testimonial.place).toBeNull();
    expect(JSON.stringify(list.body)).not.toContain("sita@example.com");

    // Hiding takes it off the site and un-features it
    const hidden = await patch(byName("Ram").id, { status: "hidden" });
    expect(hidden.body.testimonial).toMatchObject({ status: "hidden", featured: false });
    expect((await request(api()).get("/api/testimonials")).body.count).toBe(1);

    const waiting = await request(api()).get("/api/admin/testimonials?status=new").set("Authorization", `Bearer ${editor}`);
    expect(waiting.body.testimonials.map((t: { name: string }) => t.name)).toEqual(["Hari"]);
    expect(waiting.body.counts).toEqual({ new: 1, approved: 1, hidden: 1, spam: 0 });

    expect((await request(api()).delete(`/api/admin/testimonials/${byName("Hari").id}`).set("Authorization", `Bearer ${editor}`)).status).toBe(204);
    expect(await db.select().from(schema.testimonials)).toHaveLength(2);
  });

  it("is only for content editors", async () => {
    expect((await request(api()).get("/api/admin/testimonials")).status).toBe(401);
    const manager = await tokenFor("appointment_manager");
    expect((await request(api()).get("/api/admin/testimonials").set("Authorization", `Bearer ${manager}`)).status).toBe(403);
  });
});
