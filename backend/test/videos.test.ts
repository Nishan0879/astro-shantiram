import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { parseYoutubeId } from "../src/services/videos.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let token: string;
let youtubeOnline = true;

// Stands in for YouTube's oEmbed endpoint
const youtubeFetch = (async (url: string | URL) => {
  if (!youtubeOnline) throw new Error("offline");
  const id = new URL(String(url)).searchParams.get("url")?.split("v=")[1];
  return new Response(JSON.stringify({ title: `Gita pravachan ${id}`, author_name: "Astro Shantiram" }), { status: 200 });
}) as typeof fetch;

const api = () => createApp({ db, mailer: { async send() {} }, corsOrigins: [], jwtSecret, youtubeFetch });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

const gita = {
  youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
  kind: "video",
  status: "published",
  category: "gita",
  language: "ne",
  publishedOn: "2026-09-01",
  featured: false,
  translations: {
    en: { title: "Bhagavad Gita, chapter 2", description: "On the soul." },
    ne: { title: "", description: "" },
  },
};

const post = (body: object) => as(request(api()).post("/api/admin/videos")).send(body);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.videos);
  await db.delete(schema.users);
  youtubeOnline = true;
  const [user] = await db
    .insert(schema.users)
    .values({ email: "g@example.com", name: "G", passwordHash: "x", role: "guru" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("YouTube links", () => {
  it("finds the video id in every kind of link", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ]) {
      expect(parseYoutubeId(link), link).toBe("dQw4w9WgXcQ");
    }
    for (const link of ["https://vimeo.com/123", "https://www.youtube.com/@channel", "https://evil.example/watch?v=dQw4w9WgXcQ", "hello"]) {
      expect(parseYoutubeId(link), link).toBeNull();
    }
  });
});

describe("admin videos", () => {
  it("looks up the title, the kind of video, and whether it is already added", async () => {
    const res = await as(request(api()).get("/api/admin/videos/lookup").query({ url: "https://youtube.com/shorts/dQw4w9WgXcQ" }));
    expect(res.body).toEqual({ youtubeId: "dQw4w9WgXcQ", kind: "short", title: "Gita pravachan dQw4w9WgXcQ", channel: "Astro Shantiram", existingId: null });

    const created = await post(gita);
    youtubeOnline = false;
    const again = await as(request(api()).get("/api/admin/videos/lookup").query({ url: gita.youtubeUrl }));
    expect(again.body).toMatchObject({ title: null, existingId: created.body.video.id });

    expect((await as(request(api()).get("/api/admin/videos/lookup").query({ url: "https://vimeo.com/1" }))).status).toBe(400);
  });

  it("needs a YouTube link and a title", async () => {
    const res = await post({ ...gita, youtubeUrl: "https://vimeo.com/1", translations: { en: { title: "", description: "Words" } } });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toMatchObject({ youtubeUrl: expect.stringContaining("YouTube"), "translations.en.title": "Add a title" });
  });

  it("creates, edits and deletes a video, and refuses the same video twice", async () => {
    const created = await post(gita);
    expect(created.status).toBe(201);
    expect(created.body.video).toMatchObject({ youtubeId: "dQw4w9WgXcQ", publishedOn: "2026-09-01" });
    const id = created.body.video.id;

    const twice = await post({ ...gita, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" });
    expect(twice.status).toBe(409);
    expect(twice.body.fieldErrors.youtubeUrl).toBe("This video is already on the site");

    const updated = await as(request(api()).put(`/api/admin/videos/${id}`)).send({ ...gita, publishedOn: "", featured: true });
    expect(updated.status).toBe(200);
    expect(updated.body.video).toMatchObject({ publishedOn: null, featured: true });

    expect((await as(request(api()).delete(`/api/admin/videos/${id}`))).status).toBe(204);
    expect((await as(request(api()).get(`/api/admin/videos/${id}`))).status).toBe(404);
  });

  it("is closed to visitors", async () => {
    expect((await request(api()).get("/api/admin/videos")).status).toBe(401);
  });
});

describe("public videos", () => {
  it("lists newest first, filters by topic, language and featured, and searches", async () => {
    await post(gita);
    await post({ ...gita, youtubeUrl: "aaaaaaaaaaa", category: "astrology", language: "en", publishedOn: "2026-09-20", featured: true, translations: { ne: { title: "ग्रह र जीवन", description: "शनि" } } });
    await post({ ...gita, youtubeUrl: "bbbbbbbbbbb", status: "draft" });

    const all = await request(api()).get("/api/videos?locale=en");
    expect(all.body.total).toBe(2);
    expect(all.body.videos.map((v: { youtubeId: string }) => v.youtubeId)).toEqual(["aaaaaaaaaaa", "dQw4w9WgXcQ"]);
    expect(all.body.videos[0]).toMatchObject({ locale: "ne", title: "ग्रह र जीवन" });

    const ids = async (query: string) =>
      (await request(api()).get(`/api/videos?${query}`)).body.videos.map((v: { youtubeId: string }) => v.youtubeId);
    expect(await ids("category=gita")).toEqual(["dQw4w9WgXcQ"]);
    expect(await ids("language=en")).toEqual(["aaaaaaaaaaa"]);
    expect(await ids("featured=1")).toEqual(["aaaaaaaaaaa"]);
    expect(await ids("q=शनि")).toEqual(["aaaaaaaaaaa"]);
    expect(await ids("q=soul")).toEqual(["dQw4w9WgXcQ"]);
    expect(await ids("limit=1")).toEqual(["aaaaaaaaaaa"]);

    const one = await request(api()).get("/api/videos/dQw4w9WgXcQ?locale=sa");
    expect(one.body.video).toMatchObject({ locale: "en", title: "Bhagavad Gita, chapter 2", description: "On the soul." });
    expect((await request(api()).get("/api/videos/bbbbbbbbbbb")).status).toBe(404);
  });
});
