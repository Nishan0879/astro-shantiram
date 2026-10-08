import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { deviceOf, referrerHost } from "../src/routes/stats.js";
import { hashPassword, signToken } from "../src/services/auth.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
const internalApiKey = "internal-key-for-tests";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";

let db: Database;
// 2026-10-08 10:00 in Dallas
let clock = new Date("2026-10-08T15:00:00Z");
const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, internalApiKey, now: () => clock });

function view(path: string, { ua = iphone, ip = "203.0.113.5", referrer = "", key = internalApiKey } = {}) {
  return request(api())
    .post("/api/stats/view")
    .set("x-internal-key", key)
    .set("x-visitor-ip", ip)
    .set("x-visitor-ua", ua)
    .send({ path, referrer });
}

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
  clock = new Date("2026-10-08T15:00:00Z");
  await db.delete(schema.pageViews);
  await db.delete(schema.users);
});

describe("telling devices and referrers apart", () => {
  it("sorts phones, tablets and computers", () => {
    expect(deviceOf(iphone)).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(deviceOf(mac)).toBe("desktop");
  });

  it("keeps only another site's host name", () => {
    expect(referrerHost("https://www.Google.com/search?q=astrologer", ["astro-shantiram.vercel.app"])).toBe("google.com");
    expect(referrerHost("https://astro-shantiram.vercel.app/en/books", ["astro-shantiram.vercel.app"])).toBeNull();
    expect(referrerHost("", [])).toBeNull();
    expect(referrerHost("not a url", [])).toBeNull();
  });
});

describe("POST /api/stats/view", () => {
  it("accepts views only from the website", async () => {
    expect((await view("/en", { key: "wrong" })).status).toBe(403);
    expect(await db.select().from(schema.pageViews)).toHaveLength(0);
  });

  it("stores the page without its query, and no IP or browser", async () => {
    const res = await view("/ne/books?q=gita#top", { referrer: "https://www.facebook.com/somepage" });
    expect(res.status).toBe(204);
    const [row] = await db.select().from(schema.pageViews);
    expect(row).toMatchObject({ day: "2026-10-08", path: "/ne/books", locale: "ne", referrer: "facebook.com", device: "mobile" });
    expect(row.visitor).toHaveLength(16);
    expect(JSON.stringify(row)).not.toContain("203.0.113.5");
  });

  it("skips bots and the admin pages", async () => {
    await view("/en", { ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    await view("/en", { ua: "" });
    await view("/admin/appointments");
    expect(await db.select().from(schema.pageViews)).toHaveLength(0);
  });

  it("rejects paths that are not on the site", async () => {
    expect((await view("https://spam.example.com")).status).toBe(400);
  });

  it("knows the same visitor within a day, but not across days", async () => {
    await view("/en");
    await view("/en/books");
    await view("/en", { ip: "198.51.100.7", ua: mac });
    clock = new Date("2026-10-09T15:00:00Z");
    await view("/en");
    const rows = await db.select().from(schema.pageViews);
    const [first, second, other, nextDay] = rows.map((r) => r.visitor);
    expect(first).toBe(second);
    expect(other).not.toBe(first);
    expect(nextDay).not.toBe(first);
  });
});

describe("GET /api/admin/stats", () => {
  it("adds up visits, pages across languages, sources, devices and languages", async () => {
    clock = new Date("2026-10-06T15:00:00Z");
    await view("/en", { referrer: "https://www.google.com/" });
    clock = new Date("2026-10-08T15:00:00Z");
    await view("/en");
    await view("/en/books");
    await view("/ne/books", { ip: "198.51.100.7", ua: mac });
    await view("/ne", { ip: "198.51.100.7", ua: mac });

    const res = await request(api())
      .get("/api/admin/stats?days=7")
      .set("Authorization", `Bearer ${await tokenFor("guru")}`);
    expect(res.status).toBe(200);
    expect(res.body.from).toBe("2026-10-02");
    expect(res.body.today).toBe("2026-10-08");
    expect(res.body.totals).toEqual({ views: 5, visitors: 3 });
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days.at(-1)).toEqual({ date: "2026-10-08", views: 4, visitors: 2 });
    expect(res.body.days.at(-2)).toEqual({ date: "2026-10-07", views: 0, visitors: 0 });
    expect(res.body.pages.slice(0, 2)).toEqual([
      { path: "/", views: 3 },
      { path: "/books", views: 2 },
    ]);
    expect(res.body.referrers).toEqual([{ host: "google.com", visitors: 1 }]);
    expect(res.body.devices).toEqual(expect.arrayContaining([{ device: "mobile", visitors: 2 }, { device: "desktop", visitors: 1 }]));
    expect(res.body.locales).toEqual(expect.arrayContaining([{ locale: "en", views: 3 }, { locale: "ne", views: 2 }]));
  });

  it("is only for Guruji and the main admin", async () => {
    expect((await request(api()).get("/api/admin/stats")).status).toBe(401);
    const res = await request(api())
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${await tokenFor("content_admin")}`);
    expect(res.status).toBe(403);
  });
});
