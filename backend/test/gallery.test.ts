import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { cloudinaryMedia, type Media, parseCloudinaryUrl, signParams } from "../src/services/media.js";

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

const api = (m: Media | null = media) =>
  createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, media: m ?? undefined });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

const photo = {
  kind: "photo",
  url: "https://res.cloudinary.com/demo/image/upload/v1/astro-shantiram/gallery/aarati.jpg",
  publicId: "astro-shantiram/gallery/aarati",
  width: 1200,
  height: 800,
  category: "puja",
  captions: { en: "Evening aarati", ne: "", sa: "" },
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.galleryItems);
  await db.delete(schema.articles);
  await db.delete(schema.users);
  destroyed = [];
  const [user] = await db
    .insert(schema.users)
    .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("cloudinary", () => {
  it("reads the dashboard's CLOUDINARY_URL", () => {
    expect(parseCloudinaryUrl("cloudinary://123456:abcSECRET@my-cloud")).toEqual({
      apiKey: "123456",
      apiSecret: "abcSECRET",
      cloudName: "my-cloud",
    });
    expect(parseCloudinaryUrl("my-cloud")).toBeNull();
  });

  it("signs like Cloudinary's documented example", () => {
    // https://cloudinary.com/documentation/authentication_signatures
    expect(
      signParams({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd"),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("signs uploads into our folder only and recognises our URLs", () => {
    const m = cloudinaryMedia({ cloudName: "my-cloud", apiKey: "k", apiSecret: "s" });
    const sig = m.signUpload("gallery");
    expect(sig).toMatchObject({ folder: "astro-shantiram/gallery", uploadUrl: "https://api.cloudinary.com/v1_1/my-cloud/image/upload" });
    expect(sig.signature).toBe(signParams({ folder: "astro-shantiram/gallery", timestamp: sig.timestamp }, "s"));
    expect(m.owns("https://res.cloudinary.com/my-cloud/image/upload/v1/x.jpg")).toBe(true);
    expect(m.owns("https://res.cloudinary.com/other/image/upload/v1/x.jpg")).toBe(false);
  });
});

describe("uploads", () => {
  it("signs for known folders only, and says when storage is not set up", async () => {
    expect((await as(request(api()).post("/api/admin/uploads/sign")).send({ folder: "gallery" })).body.folder).toBe("gallery");
    expect((await as(request(api()).post("/api/admin/uploads/sign")).send({ folder: "../etc" })).status).toBe(400);
    expect((await as(request(api(null)).post("/api/admin/uploads/sign")).send({ folder: "gallery" })).status).toBe(503);
    expect((await request(api()).post("/api/admin/uploads/sign").send({ folder: "gallery" })).status).toBe(401);
  });
});

describe("gallery", () => {
  it("adds photos and YouTube videos, rejecting other links", async () => {
    const added = await as(request(api()).post("/api/admin/gallery")).send(photo);
    expect(added.status).toBe(201);
    expect(added.body.item.captions).toEqual({ en: "Evening aarati" });

    const video = await as(request(api()).post("/api/admin/gallery")).send({
      kind: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      category: "events",
    });
    expect(video.status).toBe(201);

    const stranger = await as(request(api()).post("/api/admin/gallery")).send({ ...photo, url: "https://evil.example/x.jpg" });
    expect(stranger.body.fieldErrors).toEqual({ url: "Upload the photo first" });
    const notYoutube = await as(request(api()).post("/api/admin/gallery")).send({ kind: "video", url: "https://vimeo.com/1", category: "events" });
    expect(Object.keys(notYoutube.body.fieldErrors)).toEqual(["url"]);
  });

  it("edits captions, deletes from storage too, and lists publicly with caption fallback", async () => {
    const { body } = await as(request(api()).post("/api/admin/gallery")).send(photo);
    await as(request(api()).post("/api/admin/gallery")).send({ ...photo, category: "temple", captions: {} });

    const edited = await as(request(api()).patch(`/api/admin/gallery/${body.item.id}`)).send({
      category: "puja",
      captions: { ne: "साँझको आरती" },
    });
    expect(edited.body.item.captions).toEqual({ ne: "साँझको आरती" });

    const sa = await request(api()).get("/api/gallery?locale=sa&category=puja");
    expect(sa.body.items).toMatchObject([{ caption: "साँझको आरती", captionLocale: "ne", width: 1200 }]);
    expect((await request(api()).get("/api/gallery")).body.total).toBe(2);

    expect((await as(request(api()).delete(`/api/admin/gallery/${body.item.id}`))).status).toBe(204);
    expect(destroyed).toEqual(["astro-shantiram/gallery/aarati"]);
    expect((await request(api()).get("/api/gallery")).body.total).toBe(1);
  });
});

describe("article covers", () => {
  const article = {
    slug: "with-cover",
    category: "puja",
    status: "published",
    translations: { en: { title: "T", body: "B" } },
  };

  it("accepts our own photos only and shows them publicly", async () => {
    const bad = await as(request(api()).post("/api/admin/articles")).send({ ...article, coverUrl: "https://evil.example/x.jpg" });
    expect(bad.body.fieldErrors).toEqual({ coverUrl: "Upload the photo again" });

    const ok = await as(request(api()).post("/api/admin/articles")).send({ ...article, coverUrl: photo.url });
    expect(ok.body.article.coverUrl).toBe(photo.url);
    expect((await request(api()).get("/api/articles/with-cover")).body.article.coverUrl).toBe(photo.url);
    expect((await request(api()).get("/api/articles")).body.articles[0].coverUrl).toBe(photo.url);
  });
});
