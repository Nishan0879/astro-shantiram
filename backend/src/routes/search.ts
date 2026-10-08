import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import {
  articles,
  articleTranslations,
  books,
  bookTranslations,
  type ContentLocale,
  contentLocales,
  events,
  eventTranslations,
  services,
  serviceTranslations,
  videos,
  videoTranslations,
} from "../db/schema.js";
import { pickTranslation } from "../services/translations.js";

const PER_KIND = 6;
const searchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  locale: z.enum(contentLocales).default("en"),
});

/** Escapes % and _ so a search for "50%" means the text, not a wildcard. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Results whose title holds the words come before ones that match only in the text. */
function titleFirst<T>(rows: T[], title: (row: T) => string | null | undefined, q: string) {
  const needle = q.toLocaleLowerCase();
  const hit = (row: T) => ((title(row) ?? "").toLocaleLowerCase().includes(needle) ? 0 : 1);
  return rows.map((row, i) => ({ row, i })).sort((a, b) => hit(a.row) - hit(b.row) || a.i - b.i).map(({ row }) => row);
}

/** Groups translations by their parent id, then picks the visitor's language for each. */
function translated<T extends { locale: ContentLocale }>(rows: T[], idOf: (t: T) => string, locale: ContentLocale) {
  const byId = new Map<string, T[]>();
  for (const t of rows) byId.set(idOf(t), [...(byId.get(idOf(t)) ?? []), t]);
  return (id: string) => pickTranslation(byId.get(id) ?? [], locale);
}

/** One search across the published articles, books, videos, services and events, in every language. */
export function searchRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = searchQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { q, locale } = parsed.data;
    const like = likePattern(q);
    const anyOf = (...columns: Parameters<typeof ilike>[0][]): SQL => or(...columns.map((c) => ilike(c, like)))!;

    const [articleRows, bookRows, videoRows, serviceRows, eventRows] = await Promise.all([
      db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, "published"),
            inArray(
              articles.id,
              db.select({ id: articleTranslations.articleId }).from(articleTranslations).where(anyOf(articleTranslations.title, articleTranslations.summary, articleTranslations.body)),
            ),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(PER_KIND * 3),
      db
        .select()
        .from(books)
        .where(
          and(
            eq(books.status, "published"),
            inArray(
              books.id,
              db.select({ id: bookTranslations.bookId }).from(bookTranslations).where(anyOf(bookTranslations.title, bookTranslations.author, bookTranslations.description)),
            ),
          ),
        )
        .orderBy(desc(books.featured), desc(books.createdAt))
        .limit(PER_KIND * 3),
      db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.status, "published"),
            inArray(videos.id, db.select({ id: videoTranslations.videoId }).from(videoTranslations).where(anyOf(videoTranslations.title, videoTranslations.description))),
          ),
        )
        .orderBy(desc(videos.publishedOn), desc(videos.createdAt))
        .limit(PER_KIND * 3),
      db
        .select()
        .from(services)
        .where(
          and(
            eq(services.status, "published"),
            inArray(
              services.id,
              db
                .select({ id: serviceTranslations.serviceId })
                .from(serviceTranslations)
                .where(anyOf(serviceTranslations.name, serviceTranslations.summary, serviceTranslations.description, serviceTranslations.purpose)),
            ),
          ),
        )
        .orderBy(services.sortOrder)
        .limit(PER_KIND * 3),
      db
        .select()
        .from(events)
        .where(
          and(
            eq(events.status, "published"),
            inArray(
              events.id,
              db.select({ id: eventTranslations.eventId }).from(eventTranslations).where(anyOf(eventTranslations.name, eventTranslations.location, eventTranslations.description)),
            ),
          ),
        )
        .orderBy(desc(events.eventDate))
        .limit(PER_KIND * 3),
    ]);

    const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);
    const noRows = <T>() => Promise.resolve([] as T[]);
    const [articleT, bookT, videoT, serviceT, eventT] = await Promise.all([
      articleRows.length ? db.select().from(articleTranslations).where(inArray(articleTranslations.articleId, ids(articleRows))) : noRows<typeof articleTranslations.$inferSelect>(),
      bookRows.length ? db.select().from(bookTranslations).where(inArray(bookTranslations.bookId, ids(bookRows))) : noRows<typeof bookTranslations.$inferSelect>(),
      videoRows.length ? db.select().from(videoTranslations).where(inArray(videoTranslations.videoId, ids(videoRows))) : noRows<typeof videoTranslations.$inferSelect>(),
      serviceRows.length ? db.select().from(serviceTranslations).where(inArray(serviceTranslations.serviceId, ids(serviceRows))) : noRows<typeof serviceTranslations.$inferSelect>(),
      eventRows.length ? db.select().from(eventTranslations).where(inArray(eventTranslations.eventId, ids(eventRows))) : noRows<typeof eventTranslations.$inferSelect>(),
    ]);
    const articleFor = translated(articleT, (t) => t.articleId, locale);
    const bookFor = translated(bookT, (t) => t.bookId, locale);
    const videoFor = translated(videoT, (t) => t.videoId, locale);
    const serviceFor = translated(serviceT, (t) => t.serviceId, locale);
    const eventFor = translated(eventT, (t) => t.eventId, locale);

    const results = {
      articles: titleFirst(
        articleRows.map((a) => ({ a, t: articleFor(a.id) })),
        (r) => r.t?.title,
        q,
      )
        .slice(0, PER_KIND)
        .map(({ a, t }) => ({ slug: a.slug, title: t?.title ?? a.slug, summary: t?.summary ?? null, coverUrl: a.coverUrl, locale: t?.locale ?? locale })),
      books: titleFirst(
        bookRows.map((b) => ({ b, t: bookFor(b.id) })),
        (r) => r.t?.title,
        q,
      )
        .slice(0, PER_KIND)
        .map(({ b, t }) => ({ slug: b.slug, title: t?.title ?? b.slug, author: t?.author ?? null, coverUrl: b.coverUrl, locale: t?.locale ?? locale })),
      videos: titleFirst(
        videoRows.map((v) => ({ v, t: videoFor(v.id) })),
        (r) => r.t?.title,
        q,
      )
        .slice(0, PER_KIND)
        .map(({ v, t }) => ({ youtubeId: v.youtubeId, title: t?.title ?? v.youtubeId, kind: v.kind, locale: t?.locale ?? locale })),
      services: titleFirst(
        serviceRows.map((s) => ({ s, t: serviceFor(s.id) })),
        (r) => r.t?.name,
        q,
      )
        .slice(0, PER_KIND)
        .map(({ s, t }) => ({ slug: s.slug, name: t?.name ?? s.slug, summary: t?.summary ?? null, category: s.category, locale: t?.locale ?? locale })),
      events: titleFirst(
        eventRows.map((e) => ({ e, t: eventFor(e.id) })),
        (r) => r.t?.name,
        q,
      )
        .slice(0, PER_KIND)
        .map(({ e, t }) => ({ slug: e.slug, name: t?.name ?? e.slug, date: e.eventDate, location: t?.location ?? null, locale: t?.locale ?? locale })),
    };
    res.json({ q, results });
  });

  return router;
}
