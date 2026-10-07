import { and, desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { videos, videoTranslations } from "../db/schema.js";
import { inputYoutubeId, lookupYoutube, type VideoInput, videoInputSchema, videoTranslationRows } from "../services/videos.js";

const idParam = z.uuid();

/** Video (Pravachan) management for the admin dashboard; mount behind requireAuth. */
export function adminVideosRouter({ db, fetchImpl }: { db: Database; fetchImpl?: typeof fetch }) {
  const router = Router();

  async function alreadyAdded(youtubeId: string, exceptId?: string) {
    const [row] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.youtubeId, youtubeId), exceptId ? ne(videos.id, exceptId) : undefined));
    return row?.id;
  }

  function parseInput(body: unknown): { input?: VideoInput; fieldErrors?: Record<string, string> } {
    const parsed = videoInputSchema.safeParse(body);
    if (parsed.success) return { input: parsed.data };
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  async function load(id: string) {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) return undefined;
    const translations = await db.select().from(videoTranslations).where(eq(videoTranslations.videoId, id));
    return { ...video, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  const columns = (input: VideoInput) => ({
    youtubeId: inputYoutubeId(input),
    kind: input.kind,
    status: input.status,
    category: input.category,
    language: input.language,
    publishedOn: input.publishedOn,
    featured: input.featured,
  });

  const duplicate = { error: "already_added", fieldErrors: { youtubeUrl: "This video is already on the site" } };

  router.get("/", async (_req, res) => {
    const [rows, translations] = await Promise.all([
      db.select().from(videos).orderBy(desc(videos.createdAt)),
      db.select({ videoId: videoTranslations.videoId, locale: videoTranslations.locale, title: videoTranslations.title }).from(videoTranslations),
    ]);
    res.json({
      videos: rows.map((v) => {
        const own = translations.filter((t) => t.videoId === v.id);
        return { ...v, title: (own.find((t) => t.locale === "en") ?? own[0])?.title ?? v.youtubeId, locales: own.map((t) => t.locale) };
      }),
    });
  });

  // Fills in the title as soon as a link is pasted, and says if the video is already on the site
  router.get("/lookup", async (req, res) => {
    const link = typeof req.query.url === "string" ? req.query.url : "";
    const details = await lookupYoutube(link, fetchImpl);
    if (!details) {
      res.status(400).json({ error: "not_youtube" });
      return;
    }
    res.json({ ...details, existingId: (await alreadyAdded(details.youtubeId)) ?? null });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const video = id.success ? await load(id.data) : undefined;
    if (!video) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ video });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await alreadyAdded(inputYoutubeId(input))) {
      res.status(409).json(duplicate);
      return;
    }
    const id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(videos).values(columns(input)).returning({ id: videos.id });
      await tx.insert(videoTranslations).values(videoTranslationRows(created.id, input));
      return created.id;
    });
    res.status(201).json({ video: await load(id) });
  });

  router.put("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const existing = id.success ? await load(id.data) : undefined;
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await alreadyAdded(inputYoutubeId(input), existing.id)) {
      res.status(409).json(duplicate);
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(videos)
        .set({ ...columns(input), updatedAt: new Date() })
        .where(eq(videos.id, existing.id));
      await tx.delete(videoTranslations).where(eq(videoTranslations.videoId, existing.id));
      await tx.insert(videoTranslations).values(videoTranslationRows(existing.id, input));
    });
    res.json({ video: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [deleted] = id.success ? await db.delete(videos).where(eq(videos.id, id.data)).returning({ id: videos.id }) : [];
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
