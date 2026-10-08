import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";

let db: Database;
const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [] });
const search = (q: string, locale = "en") => request(api()).get(`/api/search?${new URLSearchParams({ q, locale })}`);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;

  const [article, draft, older] = await db
    .insert(schema.articles)
    .values([
      { slug: "shani-transit", category: "astrology", status: "published", publishedAt: new Date("2026-10-01") },
      { slug: "draft-shani", category: "astrology", status: "draft" },
      { slug: "saturn-remedies", category: "astrology", status: "published", publishedAt: new Date("2026-09-01") },
    ])
    .returning();
  await db.insert(schema.articleTranslations).values([
    { articleId: article.id, locale: "en", title: "Shani moves into Pisces", summary: "What Shani's transit means", body: "Saturn, or Shani, changes sign." },
    { articleId: article.id, locale: "ne", title: "शनिको राशि परिवर्तन", body: "शनि मीन राशिमा।" },
    { articleId: draft.id, locale: "en", title: "Shani draft", body: "Not ready" },
    { articleId: older.id, locale: "en", title: "Remedies for a hard Saturn", body: "Light a lamp." },
  ]);
  const [book] = await db
    .insert(schema.books)
    .values({ slug: "shani-mahatmya", status: "published", category: "dharma", language: "sa", pdfUrl: "https://example.com/a.pdf" })
    .returning();
  await db.insert(schema.bookTranslations).values({ bookId: book.id, locale: "en", title: "Shani Mahatmya", author: "Traditional" });
  const [video] = await db
    .insert(schema.videos)
    .values({ youtubeId: "abcdefghijk", status: "published", category: "gita", language: "ne" })
    .returning();
  await db.insert(schema.videoTranslations).values({ videoId: video.id, locale: "ne", title: "50% of life is karma", description: "शनि र कर्म" });
});

describe("site search", () => {
  it("finds published content of every kind, in the visitor's language", async () => {
    const res = await search("shani");
    expect(res.status).toBe(200);
    expect(res.body.results.articles.map((a: { slug: string }) => a.slug)).toEqual(["shani-transit"]);
    expect(res.body.results.books).toMatchObject([{ slug: "shani-mahatmya", title: "Shani Mahatmya", author: "Traditional" }]);

    const ne = await search("शनि", "ne");
    expect(ne.body.results.articles).toMatchObject([{ slug: "shani-transit", title: "शनिको राशि परिवर्तन", locale: "ne" }]);
    expect(ne.body.results.videos).toMatchObject([{ youtubeId: "abcdefghijk", title: "50% of life is karma" }]);
  });

  it("puts title matches first", async () => {
    const res = await search("saturn");
    expect(res.body.results.articles.map((a: { slug: string }) => a.slug)).toEqual(["saturn-remedies", "shani-transit"]);
  });

  it("finds the seeded services and treats % as text", async () => {
    const res = await search("kundali");
    expect(res.body.results.services.map((s: { slug: string }) => s.slug)).toContain("kundali");
    expect((await search("50%")).body.results.videos).toHaveLength(1);
    expect((await search("5%k")).body.results.videos).toHaveLength(0);
  });

  it("needs at least two letters", async () => {
    expect((await search("a")).status).toBe(400);
  });
});
