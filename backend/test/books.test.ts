import { PGlite } from "@electric-sql/pglite";
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
let destroyed: string[];

const media: Media = {
  signUpload: (folder) => ({ uploadUrl: "https://upload.test", apiKey: "k", timestamp: 1, folder, signature: "s" }),
  owns: (url) => url.startsWith("https://res.cloudinary.com/demo/"),
  async destroy(publicId) {
    destroyed.push(publicId);
  },
};

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, media });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

const gita = {
  slug: "bhagavad-gita-notes",
  status: "published",
  category: "dharma",
  language: "sa",
  publishedOn: "2024-03-01",
  featured: false,
  pdfUrl: "https://res.cloudinary.com/demo/image/upload/v1/astro-shantiram/books/gita.pdf",
  pdfPublicId: "astro-shantiram/books/gita",
  pageCount: 120,
  coverUrl: "",
  translations: {
    en: { title: "Notes on the Bhagavad Gita", author: "Acharya Shantiram Koirala", description: "Verse by verse." },
    ne: { title: "", author: "", description: "" },
  },
};

const post = (body: object) => as(request(api()).post("/api/admin/books")).send(body);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.books);
  await db.delete(schema.users);
  destroyed = [];
  const [user] = await db
    .insert(schema.users)
    .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("admin books", () => {
  it("needs a title and an uploaded PDF", async () => {
    const res = await post({ ...gita, pdfUrl: "", translations: { en: { title: "", author: "Someone", description: "" } } });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toMatchObject({ pdfUrl: "Upload the PDF", "translations.en.title": "Add a title" });
  });

  it("refuses PDFs and covers that are not in our storage", async () => {
    expect((await post({ ...gita, pdfUrl: "https://evil.example/book.pdf" })).body.fieldErrors).toEqual({ pdfUrl: "Upload the PDF again" });
    expect((await post({ ...gita, coverUrl: "https://evil.example/c.jpg" })).body.fieldErrors).toEqual({ coverUrl: "Upload the photo again" });
  });

  it("creates, edits and deletes a book, removing PDFs that are no longer used", async () => {
    const created = await post(gita);
    expect(created.status).toBe(201);
    const id = created.body.book.id;
    expect(created.body.book).toMatchObject({ pageCount: 120, publishedOn: "2024-03-01" });
    expect(Object.keys(created.body.book.translations)).toEqual(["en"]);

    expect((await post({ ...gita })).status).toBe(409);

    const replaced = { ...gita, pdfUrl: gita.pdfUrl.replace("gita", "gita-2"), pdfPublicId: "astro-shantiram/books/gita-2", publishedOn: "" };
    const updated = await as(request(api()).put(`/api/admin/books/${id}`)).send(replaced);
    expect(updated.status).toBe(200);
    expect(updated.body.book.publishedOn).toBeNull();
    expect(destroyed).toEqual(["astro-shantiram/books/gita"]);

    expect((await as(request(api()).delete(`/api/admin/books/${id}`))).status).toBe(204);
    expect(destroyed).toEqual(["astro-shantiram/books/gita", "astro-shantiram/books/gita-2"]);
  });

  it("is closed to visitors and signs uploads into the books folder", async () => {
    expect((await request(api()).get("/api/admin/books")).status).toBe(401);
    const sig = await as(request(api()).post("/api/admin/uploads/sign")).send({ folder: "books" });
    expect(sig.body.folder).toBe("books");
  });
});

describe("public books", () => {
  it("lists published books featured first, filters and searches in any language", async () => {
    await post(gita);
    await post({ ...gita, slug: "jyotish-basics", category: "astrology", featured: true, translations: { ne: { title: "ज्योतिषको आधार", author: "", description: "" } } });
    await post({ ...gita, slug: "draft", status: "draft" });

    const all = await request(api()).get("/api/books?locale=en");
    expect(all.body.total).toBe(2);
    expect(all.body.books.map((b: { slug: string }) => b.slug)).toEqual(["jyotish-basics", "bhagavad-gita-notes"]);
    expect(all.body.books[0]).toMatchObject({ locale: "ne", title: "ज्योतिषको आधार" });

    const astro = await request(api()).get("/api/books?category=astrology");
    expect(astro.body.books.map((b: { slug: string }) => b.slug)).toEqual(["jyotish-basics"]);

    const byAuthor = await request(api()).get(`/api/books?q=${encodeURIComponent("koirala")}`);
    expect(byAuthor.body.books.map((b: { slug: string }) => b.slug)).toEqual(["bhagavad-gita-notes"]);
    const byNepali = await request(api()).get(`/api/books?q=${encodeURIComponent("ज्योतिष")}`);
    expect(byNepali.body.books.map((b: { slug: string }) => b.slug)).toEqual(["jyotish-basics"]);
    // % is searched literally, not as a wildcard
    expect((await request(api()).get("/api/books?q=%25")).body.total).toBe(0);
  });

  it("shows one book in the visitor's language and hides drafts", async () => {
    await post(gita);
    await post({ ...gita, slug: "draft", status: "draft" });
    const res = await request(api()).get("/api/books/bhagavad-gita-notes?locale=ne");
    expect(res.body.book).toMatchObject({ locale: "en", title: "Notes on the Bhagavad Gita", pageCount: 120, language: "sa" });
    expect((await request(api()).get("/api/books/draft")).status).toBe(404);
  });
});
