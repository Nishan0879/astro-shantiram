import { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import type { Media } from "../src/services/media.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;

const media: Media = {
  signUpload: (folder) => ({ uploadUrl: "https://upload.test", apiKey: "k", timestamp: 1, folder, signature: "s" }),
  owns: (url) => url.startsWith("https://res.cloudinary.com/demo/"),
  async destroy() {},
};

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, media });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

const rudrabhishek = {
  slug: "rudrabhishek",
  status: "published",
  category: "puja",
  sortOrder: 10,
  price: "$151",
  priceFrom: true,
  durationMinutes: 120,
  modes: ["home_visit", "in_person", "home_visit"],
  bookingOpen: true,
  imageUrl: "",
  translations: {
    en: {
      name: "Rudrabhishek",
      summary: "Abhishek of Lord Shiva.",
      description: "A long description.",
      purpose: "Peace and health.",
      requirements: "Flowers, milk, a clean space.",
      location: "Dallas–Fort Worth homes",
      availability: "Mondays, especially in Shrawan",
    },
    ne: { name: "रुद्राभिषेक", summary: "", description: "", purpose: "", requirements: "", location: "", availability: "" },
  },
};

const post = (body: object) => as(request(api()).post("/api/admin/services")).send(body);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

describe("starting list", () => {
  it("brings in the 23 services the site already showed, named in all three languages", async () => {
    const [{ n }] = await db.select({ n: count() }).from(schema.services);
    const [{ t }] = await db.select({ t: count() }).from(schema.serviceTranslations);
    expect([n, t]).toEqual([23, 69]);
    const res = await request(api()).get("/api/services?locale=ne");
    expect(res.body.services).toHaveLength(23);
    expect(res.body.services[0]).toMatchObject({ category: "astrology", slug: "kundali", locale: "ne", priceCents: null });
    expect(res.body.services.at(-1)).toMatchObject({ category: "puja", slug: "custom-puja" });
  });
});

describe("services", () => {
  beforeEach(async () => {
    await db.delete(schema.services);
    await db.delete(schema.users);
    const [user] = await db
      .insert(schema.users)
      .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
      .returning();
    token = signToken(user.id, jwtSecret);
  });

  it("needs a name, a sensible price and only our own photos", async () => {
    const noName = await post({ ...rudrabhishek, translations: { en: { name: "", summary: "Something" } } });
    expect(noName.body.fieldErrors).toMatchObject({ "translations.en.name": "Add the name" });
    expect((await post({ ...rudrabhishek, translations: {} })).body.fieldErrors).toMatchObject({
      translations: "Add the name in at least one language",
    });
    expect((await post({ ...rudrabhishek, price: "about 50" })).body.fieldErrors).toMatchObject({
      price: "Type the price in dollars, like 51 or 151.00",
    });
    expect((await post({ ...rudrabhishek, price: "" })).body.fieldErrors).toMatchObject({
      price: "Add the starting price, or untick “Starting price”",
    });
    expect((await post({ ...rudrabhishek, durationMinutes: 2 })).body.fieldErrors).toMatchObject({ durationMinutes: "At least 5 minutes" });
    expect((await post({ ...rudrabhishek, imageUrl: "https://evil.example/a.jpg" })).body.fieldErrors).toEqual({
      imageUrl: "Upload the photo again",
    });
  });

  it("creates, edits and deletes a service", async () => {
    const created = await post(rudrabhishek);
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ priceCents: 15100, priceFrom: true, modes: ["in_person", "home_visit"] });
    const id = created.body.service.id;

    expect((await post({ ...rudrabhishek, price: "1,001.5" })).status).toBe(409);

    const edited = await as(request(api()).put(`/api/admin/services/${id}`)).send({ ...rudrabhishek, price: "1,001.5", priceFrom: false, durationMinutes: null });
    expect(edited.body.service).toMatchObject({ priceCents: 100150, priceFrom: false, durationMinutes: null });
    expect(Object.keys(edited.body.service.translations).sort()).toEqual(["en", "ne"]);

    const list = await as(request(api()).get("/api/admin/services"));
    expect(list.body.services).toMatchObject([{ name: "Rudrabhishek", locales: expect.arrayContaining(["en", "ne"]) }]);

    expect((await as(request(api()).delete(`/api/admin/services/${id}`))).status).toBe(204);
    expect((await as(request(api()).get(`/api/admin/services/${id}`))).status).toBe(404);
  });

  it("shows visitors only published services, in their language when written", async () => {
    await post(rudrabhishek);
    await post({ ...rudrabhishek, slug: "havan", status: "draft", translations: { en: { name: "Havan" } } });
    await post({ ...rudrabhishek, slug: "kundali", category: "astrology", sortOrder: 50, translations: { en: { name: "Kundali" } } });

    const list = await request(api()).get("/api/services?locale=ne");
    expect(list.body.services.map((s: { slug: string; name: string }) => [s.slug, s.name])).toEqual([
      ["kundali", "Kundali"],
      ["rudrabhishek", "रुद्राभिषेक"],
    ]);
    const pujas = await request(api()).get("/api/services?category=puja");
    expect(pujas.body.services).toHaveLength(1);

    const detail = await request(api()).get("/api/services/rudrabhishek?locale=en");
    expect(detail.body.service).toMatchObject({ name: "Rudrabhishek", purpose: "Peace and health.", priceCents: 15100, locale: "en" });
    expect(detail.body.service.serviceId).toBeUndefined();
    expect((await request(api()).get("/api/services/havan")).status).toBe(404);
  });

  it("is for signed-in editors only", async () => {
    expect((await request(api()).get("/api/admin/services")).status).toBe(401);
  });
});
