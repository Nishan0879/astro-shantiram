import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { bookLanguages, contentLocales, videoCategories, videos, videoTranslations } from "../db/schema.js";
import { pickTranslation } from "../services/translations.js";

const PAGE_SIZE = 12;

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  category: z.enum(videoCategories).optional(),
  language: z.enum(bookLanguages).optional(),
  q: z.string().trim().max(100).optional(),
  featured: z.literal("1").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE).default(PAGE_SIZE),
});

const detailQuery = z.object({ locale: z.enum(contentLocales).default("en") });

/** Escapes % and _ so a search for "50%" means the text, not a wildcard. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// Newest first by the date it was on YouTube, or else by when it was added here
const newestFirst = desc(sql`coalesce(${videos.publishedOn}, ${videos.createdAt}::date)`);

/** Published videos for the public Pravachan page. */
export function videosRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, category, language, q, featured, page, limit } = parsed.data;

    // Search the title and description in every language
    const matching = q
      ? db
          .select({ id: videoTranslations.videoId })
          .from(videoTranslations)
          .where(or(ilike(videoTranslations.title, likePattern(q)), ilike(videoTranslations.description, likePattern(q))))
      : undefined;
    const where = and(
      eq(videos.status, "published"),
      category ? eq(videos.category, category) : undefined,
      language ? eq(videos.language, language) : undefined,
      featured ? eq(videos.featured, true) : undefined,
      matching ? inArray(videos.id, matching) : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(videos)
        .where(where)
        .orderBy(newestFirst, desc(videos.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ total: count() }).from(videos).where(where),
    ]);
    const translations = rows.length
      ? await db
          .select({ videoId: videoTranslations.videoId, locale: videoTranslations.locale, title: videoTranslations.title })
          .from(videoTranslations)
          .where(inArray(videoTranslations.videoId, rows.map((r) => r.id)))
      : [];

    const list = rows.flatMap((v) => {
      const t = pickTranslation(translations.filter((t) => t.videoId === v.id), locale);
      if (!t) return [];
      return [
        {
          youtubeId: v.youtubeId,
          kind: v.kind,
          category: v.category,
          language: v.language,
          publishedOn: v.publishedOn,
          featured: v.featured,
          locale: t.locale,
          title: t.title,
        },
      ];
    });
    res.json({ videos: list, total, page, pageSize: limit });
  });

  router.get("/:youtubeId", async (req, res) => {
    const parsed = detailQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.youtubeId, req.params.youtubeId), eq(videos.status, "published")));
    const translations = video ? await db.select().from(videoTranslations).where(eq(videoTranslations.videoId, video.id)) : [];
    const t = pickTranslation(translations, parsed.data.locale);
    if (!video || !t) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      video: {
        youtubeId: video.youtubeId,
        kind: video.kind,
        category: video.category,
        language: video.language,
        publishedOn: video.publishedOn,
        featured: video.featured,
        createdAt: video.createdAt,
        locale: t.locale,
        title: t.title,
        description: t.description,
      },
    });
  });

  return router;
}
