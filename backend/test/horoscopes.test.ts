import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { coversToday, periodStart } from "../src/services/horoscopes.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;
let today = "2026-10-07"; // a Wednesday

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, today: () => today });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });
const post = (body: object) => as(request(api()).post("/api/admin/horoscopes")).send(body);

const daily = {
  period: "daily",
  startsOn: "2026-10-07",
  status: "published",
  translations: {},
  readings: {
    mesha: {
      en: { overview: "A bold day.", career: "Speak up at work.", finance: "", relationships: "", health: "", spiritual: "", lucky: "Red, 9" },
      ne: { overview: "साहसी दिन।" },
    },
    meena: { en: { overview: "Rest and reflect." } },
  },
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.horoscopeEditions);
  await db.delete(schema.users);
  today = "2026-10-07";
  const [user] = await db
    .insert(schema.users)
    .values({ email: "g@example.com", name: "G", passwordHash: "x", role: "guru" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("horoscope periods", () => {
  it("starts weeks on Sunday, months on the 1st and years on January 1", () => {
    expect(periodStart("weekly", "2026-10-07")).toBe("2026-10-04");
    expect(periodStart("weekly", "2026-10-04")).toBe("2026-10-04");
    expect(periodStart("weekly", "2026-01-01")).toBe("2025-12-28");
    expect(periodStart("monthly", "2026-10-07")).toBe("2026-10-01");
    expect(periodStart("yearly", "2026-10-07")).toBe("2026-01-01");
    expect(periodStart("daily", "2026-10-07")).toBe("2026-10-07");
    expect(coversToday("weekly", "2026-10-04", "2026-10-10")).toBe(true);
    expect(coversToday("weekly", "2026-10-04", "2026-10-11")).toBe(false);
    expect(coversToday("daily", "2026-10-06", "2026-10-07")).toBe(false);
  });
});

describe("admin horoscopes", () => {
  it("needs an overview for each sign that has any writing, and at least one sign", async () => {
    const res = await post({ ...daily, readings: { kanya: { en: { overview: "", career: "Something" } } } });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toEqual({ "readings.kanya.en.overview": "Add the overview" });
    expect((await post({ ...daily, readings: {} })).body.fieldErrors).toEqual({ readings: "Write the reading for at least one sign" });
  });

  it("needs a title for festival and special updates, which may speak to all signs", async () => {
    const special = { period: "special", startsOn: "2026-10-10", status: "published", translations: {}, readings: {} };
    expect((await post(special)).body.fieldErrors).toHaveProperty("translations");
    const ok = await post({ ...special, translations: { en: { title: "Mercury turns retrograde", intro: "Go slowly with contracts." } } });
    expect(ok.status).toBe(201);
  });

  it("allows one horoscope per day, week, month or year, moving dates to the start of the span", async () => {
    const weekly = await post({ ...daily, period: "weekly", startsOn: "2026-10-08" });
    expect(weekly.status).toBe(201);
    expect(weekly.body.edition.startsOn).toBe("2026-10-04");

    const again = await post({ ...daily, period: "weekly", startsOn: "2026-10-06" });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ existingId: weekly.body.edition.id, fieldErrors: { startsOn: "There is already a horoscope for this week" } });

    // A daily one for a day of that week is a different horoscope
    expect((await post(daily)).status).toBe(201);
  });

  it("creates, edits and deletes a horoscope", async () => {
    const created = await post(daily);
    const id = created.body.edition.id;
    expect(created.body.edition.readings.mesha.en).toMatchObject({ overview: "A bold day.", lucky: "Red, 9", finance: null });
    expect(Object.keys(created.body.edition.readings)).toEqual(expect.arrayContaining(["mesha", "meena"]));

    const updated = await as(request(api()).put(`/api/admin/horoscopes/${id}`)).send({ ...daily, readings: { tula: { en: { overview: "Balance." } } } });
    expect(updated.status).toBe(200);
    expect(Object.keys(updated.body.edition.readings)).toEqual(["tula"]);

    const list = await as(request(api()).get("/api/admin/horoscopes"));
    expect(list.body.editions[0]).toMatchObject({ period: "daily", signs: 1 });

    expect((await as(request(api()).delete(`/api/admin/horoscopes/${id}`))).status).toBe(204);
  });

  it("is closed to visitors", async () => {
    expect((await request(api()).get("/api/admin/horoscopes")).status).toBe(401);
  });
});

describe("public horoscopes", () => {
  it("shows the latest one that has begun, in the visitor's language where written", async () => {
    await post({ ...daily, startsOn: "2026-10-06" });
    await post({ ...daily, startsOn: "2026-10-08", readings: { mesha: { en: { overview: "Tomorrow." } } } });
    await post({ ...daily, startsOn: "2026-10-05", status: "draft" });

    let res = await request(api()).get("/api/horoscopes/current?period=daily&locale=ne");
    expect(res.body.edition).toMatchObject({ startsOn: "2026-10-06", covers: false });
    expect(res.body.edition.readings).toEqual([
      expect.objectContaining({ sign: "mesha", locale: "ne", overview: "साहसी दिन।" }),
      expect.objectContaining({ sign: "meena", locale: "en", overview: "Rest and reflect." }),
    ]);

    today = "2026-10-08";
    res = await request(api()).get("/api/horoscopes/current?period=daily");
    expect(res.body.edition).toMatchObject({ startsOn: "2026-10-08", covers: true });

    expect((await request(api()).get("/api/horoscopes/current?period=yearly")).body.edition).toBeNull();
  });

  it("lists festival and special updates and opens one", async () => {
    const created = await post({
      period: "festival",
      startsOn: "2026-10-20",
      status: "published",
      translations: { en: { title: "Dashain 2026", intro: "Blessings for all." } },
      readings: { simha: { en: { overview: "A time of honour." } } },
    });
    const list = await request(api()).get("/api/horoscopes/specials?locale=ne");
    expect(list.body.specials).toEqual([expect.objectContaining({ title: "Dashain 2026", titleLocale: "en" })]);

    const one = await request(api()).get(`/api/horoscopes/${created.body.edition.id}`);
    expect(one.body.edition).toMatchObject({ title: "Dashain 2026", intro: "Blessings for all.", readings: [expect.objectContaining({ sign: "simha" })] });
    expect((await request(api()).get("/api/horoscopes/not-an-id")).status).toBe(404);
  });
});
