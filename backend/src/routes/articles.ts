import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { articleCategories, articles, articleTranslations, contentLocales } from "../db/schema.js";
import { pickTranslation } from "../services/translations.js";

const PAGE_SIZE = 12;

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  category: z.enum(articleCategories).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const detailQuery = z.object({ locale: z.enum(contentLocales).default("en") });

/** Published articles for the public website. */
export function articlesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, category, page } = parsed.data;
    const where = and(
      eq(articles.status, "published"),
      category ? eq(articles.category, category) : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(articles)
        .where(where)
        .orderBy(desc(articles.publishedAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(articles).where(where),
    ]);
    const translations = rows.length
      ? await db
          .select({
            articleId: articleTranslations.articleId,
            locale: articleTranslations.locale,
            title: articleTranslations.title,
            summary: articleTranslations.summary,
          })
          .from(articleTranslations)
          .where(inArray(articleTranslations.articleId, rows.map((r) => r.id)))
      : [];

    const list = rows.flatMap((a) => {
      const t = pickTranslation(translations.filter((t) => t.articleId === a.id), locale);
      if (!t) return [];
      return [{ slug: a.slug, category: a.category, publishedAt: a.publishedAt, locale: t.locale, title: t.title, summary: t.summary }];
    });
    res.json({ articles: list, total, page, pageSize: PAGE_SIZE });
  });

  router.get("/:slug", async (req, res) => {
    const parsed = detailQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const [article] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, req.params.slug), eq(articles.status, "published")));
    const translations = article
      ? await db.select().from(articleTranslations).where(eq(articleTranslations.articleId, article.id))
      : [];
    const t = pickTranslation(translations, parsed.data.locale);
    if (!article || !t) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({
      article: {
        slug: article.slug,
        category: article.category,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        locale: t.locale,
        title: t.title,
        summary: t.summary,
        body: t.body,
        locales: translations.map((tr) => tr.locale),
      },
    });
  });

  return router;
}
