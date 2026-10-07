import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret });
const admin = () => {
  const a = api();
  return {
    post: (body: object) => request(a).post("/api/admin/articles").auth(token, { type: "bearer" }).send(body),
    put: (id: string, body: object) => request(a).put(`/api/admin/articles/${id}`).auth(token, { type: "bearer" }).send(body),
    get: (path = "") => request(a).get(`/api/admin/articles${path}`).auth(token, { type: "bearer" }),
    del: (id: string) => request(a).delete(`/api/admin/articles/${id}`).auth(token, { type: "bearer" }),
  };
};

const shivaratri = {
  slug: "meaning-of-maha-shivaratri",
  category: "festivals",
  status: "published",
  translations: {
    en: { title: "Meaning of Maha Shivaratri", summary: "Why we fast", body: "## The night of Shiva\n\nText." },
    ne: { title: "महाशिवरात्रिको अर्थ", summary: "", body: "पाठ" },
    sa: { title: "", summary: "", body: "" },
  },
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.articles);
  await db.delete(schema.users);
  const [user] = await db
    .insert(schema.users)
    .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("admin articles", () => {
  it("creates an article with the languages that were filled in", async () => {
    const res = await admin().post(shivaratri);

    expect(res.status).toBe(201);
    expect(res.body.article).toMatchObject({ slug: shivaratri.slug, status: "published" });
    expect(res.body.article.publishedAt).not.toBeNull();
    expect(Object.keys(res.body.article.translations).sort()).toEqual(["en", "ne"]);
    expect(res.body.article.translations.ne.summary).toBeNull();
  });

  it("explains what is missing", async () => {
    const res = await admin().post({
      ...shivaratri,
      slug: "Bad Slug!",
      translations: { en: { title: "Only a title" } },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["slug", "translations.en.body"]);

    const empty = await admin().post({ ...shivaratri, translations: { en: { title: "", body: "" } } });
    expect(empty.body.fieldErrors).toEqual({ translations: "Write the article in at least one language" });
  });

  it("refuses a second article with the same address", async () => {
    await admin().post(shivaratri);
    const res = await admin().post(shivaratri);
    expect(res.status).toBe(409);
    expect(res.body.fieldErrors.slug).toBeDefined();
  });

  it("updates, keeps the first publish date, and deletes", async () => {
    const { body } = await admin().post({ ...shivaratri, status: "draft" });
    const id = body.article.id;
    expect(body.article.publishedAt).toBeNull();

    const published = await admin().put(id, shivaratri);
    const firstPublished = published.body.article.publishedAt;
    expect(firstPublished).not.toBeNull();

    const edited = await admin().put(id, {
      ...shivaratri,
      translations: { sa: { title: "शिवरात्रिः", body: "पाठः" } },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.article.publishedAt).toBe(firstPublished);
    expect(Object.keys(edited.body.article.translations)).toEqual(["sa"]);

    const list = await admin().get();
    expect(list.body.articles).toMatchObject([{ id, title: "शिवरात्रिः", locales: ["sa"] }]);

    expect((await admin().del(id)).status).toBe(204);
    expect((await admin().get(`/${id}`)).status).toBe(404);
  });

  it("is not open to signed-out visitors", async () => {
    expect((await request(api()).get("/api/admin/articles")).status).toBe(401);
  });
});

describe("public articles", () => {
  it("lists published articles in the visitor's language, falling back to another", async () => {
    await admin().post(shivaratri);
    await admin().post({ ...shivaratri, slug: "draft-one", status: "draft" });
    await admin().post({
      ...shivaratri,
      slug: "nepali-only",
      category: "puja",
      translations: { ne: { title: "पूजा", body: "पाठ" } },
    });

    const ne = await request(api()).get("/api/articles?locale=ne");
    expect(ne.body.total).toBe(2);
    expect(ne.body.articles.map((a: { title: string }) => a.title).sort()).toEqual(["पूजा", "महाशिवरात्रिको अर्थ"]);

    const sa = await request(api()).get("/api/articles?locale=sa&category=festivals");
    expect(sa.body.articles).toMatchObject([{ slug: shivaratri.slug, locale: "en", title: "Meaning of Maha Shivaratri" }]);
  });

  it("shows one published article and hides drafts", async () => {
    await admin().post(shivaratri);
    await admin().post({ ...shivaratri, slug: "draft-one", status: "draft" });

    const res = await request(api()).get(`/api/articles/${shivaratri.slug}?locale=ne`);
    expect(res.body.article).toMatchObject({ locale: "ne", body: "पाठ", locales: ["en", "ne"] });
    expect((await request(api()).get("/api/articles/draft-one")).status).toBe(404);
    expect((await request(api()).get("/api/articles/nothing")).status).toBe(404);
  });
});
