import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { parseFestivalList } from "../src/services/festivals.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;
const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, today: () => "2026-10-12" });
const admin = (r: request.Test) => r.auth(token, { type: "bearer" });

const dashain = {
  date: "2026-10-11",
  endDate: "2026-10-25",
  kind: "festival",
  serviceSlug: "navagraha-puja",
  translations: { en: { name: "Dashain", description: "The great festival." }, ne: { name: "दशैं" } },
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.festivals);
  await db.delete(schema.events);
  await db.delete(schema.users);
  const [user] = await db.insert(schema.users).values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" }).returning();
  token = signToken(user.id, jwtSecret);
});

describe("admin festivals", () => {
  it("adds, edits and deletes a festival in several languages", async () => {
    const created = await admin(request(api()).post("/api/admin/festivals")).send(dashain);
    expect(created.status).toBe(201);
    const id = created.body.festival.id;
    expect(created.body.festival).toMatchObject({ date: "2026-10-11", endDate: "2026-10-25", status: "published", translations: { ne: { name: "दशैं" } } });

    const list = await admin(request(api()).get("/api/admin/festivals?year=2026"));
    expect(list.body.festivals).toMatchObject([{ id, name: "Dashain", locales: ["en", "ne"] }]);

    const edited = await admin(request(api()).put(`/api/admin/festivals/${id}`)).send({ ...dashain, status: "draft", translations: { en: { name: "Bada Dashain" } } });
    expect(edited.body.festival).toMatchObject({ status: "draft", translations: { en: { name: "Bada Dashain" } } });
    expect(edited.body.festival.translations.ne).toBeUndefined();

    expect((await admin(request(api()).delete(`/api/admin/festivals/${id}`))).status).toBe(204);
    expect((await admin(request(api()).get(`/api/admin/festivals/${id}`))).status).toBe(404);
  });

  it("checks the details", async () => {
    const kind = await admin(request(api()).post("/api/admin/festivals")).send({ ...dashain, kind: "x" });
    expect(kind.body.fieldErrors).toEqual({ kind: "Choose what kind of day it is" });
    const unnamed = await admin(request(api()).post("/api/admin/festivals")).send({ ...dashain, translations: {} });
    expect(unnamed.body.fieldErrors).toEqual({ translations: "Name the day in at least one language" });
    const ends = await admin(request(api()).post("/api/admin/festivals")).send({ ...dashain, endDate: "2026-10-01" });
    expect(ends.body.fieldErrors).toEqual({ endDate: "The last day must be after the first day" });
  });

  it("adds a pasted list in one go, or nothing when a line is wrong", async () => {
    const bad = await admin(request(api()).post("/api/admin/festivals/bulk")).send({ kind: "ekadashi", text: "2026-11-01 Haribodhini\nnext week Ekadashi" });
    expect(bad.status).toBe(400);
    expect(bad.body.lines).toEqual([{ line: 2, text: "next week Ekadashi", message: "Start the line with a date like 2026-11-01 or 11/1/2026" }]);
    expect(await db.select().from(schema.festivals)).toHaveLength(0);

    const ok = await admin(request(api()).post("/api/admin/festivals/bulk")).send({
      kind: "ekadashi",
      locale: "ne",
      text: "2026-11-01 हरिबोधिनी एकादशी\n\n11/16/2026 – Utpanna Ekadashi\n",
    });
    expect(ok.body).toEqual({ created: 2 });
    const list = await admin(request(api()).get("/api/admin/festivals?year=2026"));
    expect(list.body.festivals.map((f: { date: string; name: string; kind: string }) => [f.date, f.name, f.kind])).toEqual([
      ["2026-11-01", "हरिबोधिनी एकादशी", "ekadashi"],
      ["2026-11-16", "Utpanna Ekadashi", "ekadashi"],
    ]);
  });

  it("is only for signed-in editors", async () => {
    expect((await request(api()).get("/api/admin/festivals")).status).toBe(401);
  });
});

describe("public calendar", () => {
  it("lists the year's published days with Guruji's events, in the visitor's language", async () => {
    await admin(request(api()).post("/api/admin/festivals")).send(dashain);
    await admin(request(api()).post("/api/admin/festivals")).send({ date: "2026-11-08", kind: "festival", status: "draft", translations: { en: { name: "Tihar draft" } } });
    await admin(request(api()).post("/api/admin/festivals")).send({ date: "2027-01-14", kind: "sankranti", translations: { en: { name: "Maghe Sankranti" } } });
    const [event] = await db.insert(schema.events).values({ slug: "satsang", status: "published", eventDate: "2026-11-20", startTime: "18:00" }).returning();
    await db.insert(schema.eventTranslations).values({ eventId: event.id, locale: "en", name: "Satsang" });

    const res = await request(api()).get("/api/festivals?year=2026&locale=ne");
    expect(res.body).toMatchObject({ year: 2026, today: "2026-10-12" });
    expect(res.body.festivals).toMatchObject([{ name: "दशैं", locale: "ne", endDate: "2026-10-25", serviceSlug: "navagraha-puja" }]);
    expect(res.body.festivals[0].description).toBeNull();
    expect(res.body.events).toEqual([{ slug: "satsang", date: "2026-11-20", startTime: "18:00", locale: "en", name: "Satsang" }]);
    expect((await request(api()).get("/api/festivals")).body.year).toBe(2026);
  });

  it("counts down to what is next, including a festival already under way", async () => {
    await admin(request(api()).post("/api/admin/festivals")).send({ date: "2026-10-01", kind: "festival", translations: { en: { name: "Past" } } });
    await admin(request(api()).post("/api/admin/festivals")).send(dashain);
    await admin(request(api()).post("/api/admin/festivals")).send({ date: "2026-10-22", kind: "ekadashi", translations: { en: { name: "Papankusha Ekadashi" } } });
    const res = await request(api()).get("/api/festivals/upcoming?limit=5");
    expect(res.body.festivals.map((f: { name: string }) => f.name)).toEqual(["Dashain", "Papankusha Ekadashi"]);
  });
});

describe("reading a pasted list", () => {
  it("accepts US and ISO dates and skips blank lines", () => {
    expect(parseFestivalList("1/14/2027, Maghe Sankranti\n\n2027-02-30 Bad day\n2027-03-03")).toEqual({
      days: [{ date: "2027-01-14", name: "Maghe Sankranti" }],
      errors: [
        { line: 3, text: "2027-02-30 Bad day", message: "Start the line with a date like 2026-11-01 or 11/1/2026" },
        { line: 4, text: "2027-03-03", message: "Add the name after the date" },
      ],
    });
  });
});
