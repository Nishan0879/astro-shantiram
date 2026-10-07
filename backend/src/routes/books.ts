import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { bookCategories, books, bookTranslations, contentLocales } from "../db/schema.js";
import { pickTranslation } from "../services/translations.js";

const PAGE_SIZE = 12;

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  category: z.enum(bookCategories).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const detailQuery = z.object({ locale: z.enum(contentLocales).default("en") });

/** Escapes % and _ so a search for "50%" means the text, not a wildcard. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Published books for the public library: featured first, then newest. */
export function booksRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, category, q, page } = parsed.data;

    // Search the title, author and description in every language
    const matching = q
      ? db
          .select({ id: bookTranslations.bookId })
          .from(bookTranslations)
          .where(
            or(
              ilike(bookTranslations.title, likePattern(q)),
              ilike(bookTranslations.author, likePattern(q)),
              ilike(bookTranslations.description, likePattern(q)),
            ),
          )
      : undefined;
    const where = and(
      eq(books.status, "published"),
      category ? eq(books.category, category) : undefined,
      matching ? inArray(books.id, matching) : undefined,
    );

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(books)
        .where(where)
        .orderBy(desc(books.featured), desc(books.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(books).where(where),
    ]);
    const translations = rows.length
      ? await db
          .select({ bookId: bookTranslations.bookId, locale: bookTranslations.locale, title: bookTranslations.title, author: bookTranslations.author })
          .from(bookTranslations)
          .where(inArray(bookTranslations.bookId, rows.map((r) => r.id)))
      : [];

    const list = rows.flatMap((b) => {
      const t = pickTranslation(translations.filter((t) => t.bookId === b.id), locale);
      if (!t) return [];
      return [
        {
          slug: b.slug,
          category: b.category,
          language: b.language,
          featured: b.featured,
          pdfUrl: b.pdfUrl,
          coverUrl: b.coverUrl,
          locale: t.locale,
          title: t.title,
          author: t.author,
        },
      ];
    });
    res.json({ books: list, total, page, pageSize: PAGE_SIZE });
  });

  router.get("/:slug", async (req, res) => {
    const parsed = detailQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const [book] = await db
      .select()
      .from(books)
      .where(and(eq(books.slug, req.params.slug), eq(books.status, "published")));
    const translations = book ? await db.select().from(bookTranslations).where(eq(bookTranslations.bookId, book.id)) : [];
    const t = pickTranslation(translations, parsed.data.locale);
    if (!book || !t) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      book: {
        slug: book.slug,
        category: book.category,
        language: book.language,
        publishedOn: book.publishedOn,
        featured: book.featured,
        pdfUrl: book.pdfUrl,
        pageCount: book.pageCount,
        coverUrl: book.coverUrl,
        locale: t.locale,
        title: t.title,
        author: t.author,
        description: t.description,
      },
    });
  });

  return router;
}
