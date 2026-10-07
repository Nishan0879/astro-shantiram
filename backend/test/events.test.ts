import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { todayLocal } from "../src/services/events.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret });
const post = (body: object) => request(api()).post("/api/admin/events").auth(token, { type: "bearer" }).send(body);
const put = (id: string, body: object) =>
  request(api()).put(`/api/admin/events/${id}`).auth(token, { type: "bearer" }).send(body);

const shivaratri = {
  slug: "mahashivaratri-2099",
  status: "published",
  eventDate: "2099-02-20",
  startTime: "18:00",
  endTime: "23:30",
  registrationUrl: "",
  youtubeUrl: "https://www.youtube.com/watch?v=abc",
  zoomUrl: "",
  translations: {
    en: { name: "Mahashivaratri Puja", location: "DFW Hindu Temple, Irving, TX", description: "Night-long puja." },
    ne: { name: "महाशिवरात्रि पूजा", location: "", description: "" },
  },
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.events);
  await db.delete(schema.users);
  const [user] = await db
    .insert(schema.users)
    .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("admin events", () => {
  it("creates an event, keeping only filled-in languages and links", async () => {
    const res = await post(shivaratri);
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      eventDate: "2099-02-20",
      startTime: "18:00:00",
      registrationUrl: null,
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
    });
    expect(Object.keys(res.body.event.translations).sort()).toEqual(["en", "ne"]);
    expect(res.body.event.translations.ne.location).toBeNull();
  });

  it("explains what is wrong", async () => {
    const res = await post({
      ...shivaratri,
      eventDate: "",
      endTime: "17:00",
      zoomUrl: "zoom meeting",
      translations: { en: { name: "", location: "Somewhere" } },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual([
      "endTime",
      "eventDate",
      "translations.en.name",
      "zoomUrl",
    ]);
  });

  it("updates and deletes, refusing a taken address", async () => {
    const { body } = await post(shivaratri);
    const other = await post({ ...shivaratri, slug: "janai-purnima-2099" });
    expect((await put(other.body.event.id, shivaratri)).status).toBe(409);

    const updated = await put(body.event.id, { ...shivaratri, startTime: "", endTime: "", translations: { sa: { name: "शिवरात्रिः" } } });
    expect(updated.body.event).toMatchObject({ startTime: null, endTime: null });
    expect(Object.keys(updated.body.event.translations)).toEqual(["sa"]);

    const list = await request(api()).get("/api/admin/events").auth(token, { type: "bearer" });
    expect(list.body.events.map((e: { name: string }) => e.name).sort()).toEqual(["Mahashivaratri Puja", "शिवरात्रिः"]);

    expect((await request(api()).delete(`/api/admin/events/${body.event.id}`).auth(token, { type: "bearer" })).status).toBe(204);
  });
});

describe("public events", () => {
  it("splits upcoming (soonest first) from past (latest first) and hides drafts", async () => {
    const today = todayLocal();
    await post(shivaratri);
    await post({ ...shivaratri, slug: "soon", eventDate: "2098-01-01" });
    await post({ ...shivaratri, slug: "today", eventDate: today });
    await post({ ...shivaratri, slug: "old", eventDate: "2001-01-01" });
    await post({ ...shivaratri, slug: "older", eventDate: "2000-01-01" });
    await post({ ...shivaratri, slug: "draft", status: "draft" });

    const upcoming = await request(api()).get("/api/events?locale=ne");
    expect(upcoming.body.events.map((e: { slug: string }) => e.slug)).toEqual(["today", "soon", "mahashivaratri-2099"]);
    expect(upcoming.body.events[0]).toMatchObject({ name: "महाशिवरात्रि पूजा", startTime: "18:00", locale: "ne" });

    const past = await request(api()).get("/api/events?when=past");
    expect(past.body.events.map((e: { slug: string }) => e.slug)).toEqual(["old", "older"]);
  });

  it("shows one published event with its language fallback", async () => {
    await post(shivaratri);
    await post({ ...shivaratri, slug: "draft", status: "draft" });

    const res = await request(api()).get(`/api/events/${shivaratri.slug}?locale=sa`);
    expect(res.body.event).toMatchObject({ locale: "en", location: "DFW Hindu Temple, Irving, TX", isPast: false });
    expect((await request(api()).get("/api/events/draft")).status).toBe(404);
  });
});
