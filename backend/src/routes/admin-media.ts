import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contentLocales, galleryCategories, galleryItems } from "../db/schema.js";
import type { Media } from "../services/media.js";

const folders = ["gallery", "articles", "books"] as const;
const idParam = z.uuid();

const captionsSchema = z.partialRecord(z.enum(contentLocales), z.string().trim().max(300)).transform((c) =>
  // Keep only the languages that have a caption
  Object.fromEntries(Object.entries(c).filter(([, v]) => v)),
);

const youtubeUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/.test(v),
    "Paste a YouTube link, like https://www.youtube.com/watch?v=…",
  );

const fieldErrors = (error: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
};

/** Signs photo uploads; mount behind requireAuth. */
export function adminUploadsRouter({ media, mediaProblem }: { media?: Media; mediaProblem?: string }) {
  const router = Router();

  router.post("/sign", (req, res) => {
    if (!media) {
      res.status(503).json({ error: "media_not_configured", detail: mediaProblem });
      return;
    }
    const folder = z.enum(folders).safeParse(req.body?.folder);
    if (!folder.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    res.json(media.signUpload(folder.data));
  });

  return router;
}

/** Gallery management for the admin dashboard; mount behind requireAuth. */
export function adminGalleryRouter({ db, media }: { db: Database; media?: Media }) {
  const router = Router();

  const photoSchema = z.object({
    kind: z.literal("photo"),
    url: z.url().max(500).refine((u) => media?.owns(u) ?? false, "Upload the photo first"),
    publicId: z.string().max(300),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    category: z.enum(galleryCategories),
    captions: captionsSchema.default({}),
  });
  const videoSchema = z.object({
    kind: z.literal("video"),
    url: youtubeUrl,
    category: z.enum(galleryCategories),
    captions: captionsSchema.default({}),
  });
  const createSchema = z.discriminatedUnion("kind", [photoSchema, videoSchema]);
  const updateSchema = z.object({ category: z.enum(galleryCategories), captions: captionsSchema.default({}) });

  router.get("/", async (_req, res) => {
    res.json({ items: await db.select().from(galleryItems).orderBy(desc(galleryItems.createdAt)) });
  });

  router.post("/", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrors(parsed.error) });
      return;
    }
    const [item] = await db.insert(galleryItems).values(parsed.data).returning();
    res.status(201).json({ item });
  });

  router.patch("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrors(parsed.error) });
      return;
    }
    const [item] = await db.update(galleryItems).set(parsed.data).where(eq(galleryItems.id, id.data)).returning();
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ item });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [item] = id.success ? await db.delete(galleryItems).where(eq(galleryItems.id, id.data)).returning() : [];
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (item.publicId && media) await media.destroy(item.publicId);
    res.status(204).end();
  });

  return router;
}
