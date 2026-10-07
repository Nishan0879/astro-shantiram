import { and, desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { articles, articleTranslations } from "../db/schema.js";
import { type ArticleInput, articleInputSchema, translationRows } from "../services/articles.js";
import type { Media } from "../services/media.js";

const idParam = z.uuid();

/** Article management for the admin dashboard; mount behind requireAuth. */
export function adminArticlesRouter({ db, media }: { db: Database; media?: Media }) {
  const router = Router();

  async function slugTaken(slug: string, exceptId?: string) {
    const [row] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.slug, slug), exceptId ? ne(articles.id, exceptId) : undefined));
    return Boolean(row);
  }

  function parseInput(body: unknown): { input?: ArticleInput; fieldErrors?: Record<string, string> } {
    const parsed = articleInputSchema.safeParse(body);
    if (parsed.success) {
      const { coverUrl } = parsed.data;
      // Only photos uploaded to our own storage, never arbitrary links
      if (coverUrl && !media?.owns(coverUrl)) return { fieldErrors: { coverUrl: "Upload the photo again" } };
      return { input: parsed.data };
    }
    // Flatten paths like translations.ne.title so the form can show each one
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  async function load(id: string) {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    if (!article) return undefined;
    const translations = await db.select().from(articleTranslations).where(eq(articleTranslations.articleId, id));
    return { ...article, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  router.get("/", async (_req, res) => {
    const [rows, translations] = await Promise.all([
      db.select().from(articles).orderBy(desc(articles.updatedAt)),
      db
        .select({ articleId: articleTranslations.articleId, locale: articleTranslations.locale, title: articleTranslations.title })
        .from(articleTranslations),
    ]);
    res.json({
      articles: rows.map((a) => {
        const own = translations.filter((t) => t.articleId === a.id);
        return {
          ...a,
          title: (own.find((t) => t.locale === "en") ?? own[0])?.title ?? a.slug,
          locales: own.map((t) => t.locale),
        };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const article = id.success ? await load(id.data) : undefined;
    if (!article) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ article });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await slugTaken(input.slug)) {
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another article already uses this address" } });
      return;
    }

    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(articles)
        .values({
          slug: input.slug,
          category: input.category,
          status: input.status,
          coverUrl: input.coverUrl,
          publishedAt: input.status === "published" ? new Date() : null,
          authorId: res.locals.user.id,
        })
        .returning({ id: articles.id });
      await tx.insert(articleTranslations).values(translationRows(created.id, input));
      return created.id;
    });
    res.status(201).json({ article: await load(id) });
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
    if (await slugTaken(input.slug, existing.id)) {
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another article already uses this address" } });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(articles)
        .set({
          slug: input.slug,
          category: input.category,
          status: input.status,
          coverUrl: input.coverUrl,
          publishedAt: existing.publishedAt ?? (input.status === "published" ? new Date() : null),
          updatedAt: new Date(),
        })
        .where(eq(articles.id, existing.id));
      await tx.delete(articleTranslations).where(eq(articleTranslations.articleId, existing.id));
      await tx.insert(articleTranslations).values(translationRows(existing.id, input));
    });
    res.json({ article: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const deleted = id.success
      ? await db.delete(articles).where(eq(articles.id, id.data)).returning({ id: articles.id })
      : [];
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
