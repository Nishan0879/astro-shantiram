import { and, desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { books, bookTranslations } from "../db/schema.js";
import { type BookInput, bookInputSchema, bookTranslationRows } from "../services/books.js";
import type { Media } from "../services/media.js";

const idParam = z.uuid();

/** Book library management for the admin dashboard; mount behind requireAuth. */
export function adminBooksRouter({ db, media }: { db: Database; media?: Media }) {
  const router = Router();

  async function slugTaken(slug: string, exceptId?: string) {
    const [row] = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.slug, slug), exceptId ? ne(books.id, exceptId) : undefined));
    return Boolean(row);
  }

  function parseInput(body: unknown): { input?: BookInput; fieldErrors?: Record<string, string> } {
    const parsed = bookInputSchema.safeParse(body);
    if (parsed.success) {
      const { pdfUrl, coverUrl } = parsed.data;
      // Only files uploaded to our own storage, never arbitrary links
      if (!media?.owns(pdfUrl)) return { fieldErrors: { pdfUrl: "Upload the PDF again" } };
      if (coverUrl && !media.owns(coverUrl)) return { fieldErrors: { coverUrl: "Upload the photo again" } };
      return { input: parsed.data };
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  async function load(id: string) {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    if (!book) return undefined;
    const translations = await db.select().from(bookTranslations).where(eq(bookTranslations.bookId, id));
    return { ...book, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  const columns = (input: BookInput) => ({
    slug: input.slug,
    status: input.status,
    category: input.category,
    language: input.language,
    publishedOn: input.publishedOn,
    featured: input.featured,
    pdfUrl: input.pdfUrl,
    pdfPublicId: input.pdfPublicId,
    pageCount: input.pageCount,
    coverUrl: input.coverUrl,
  });

  router.get("/", async (_req, res) => {
    const [rows, translations] = await Promise.all([
      db.select().from(books).orderBy(desc(books.updatedAt)),
      db.select({ bookId: bookTranslations.bookId, locale: bookTranslations.locale, title: bookTranslations.title }).from(bookTranslations),
    ]);
    res.json({
      books: rows.map((b) => {
        const own = translations.filter((t) => t.bookId === b.id);
        return { ...b, title: (own.find((t) => t.locale === "en") ?? own[0])?.title ?? b.slug, locales: own.map((t) => t.locale) };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const book = id.success ? await load(id.data) : undefined;
    if (!book) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ book });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await slugTaken(input.slug)) {
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another book already uses this address" } });
      return;
    }
    const id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(books).values(columns(input)).returning({ id: books.id });
      await tx.insert(bookTranslations).values(bookTranslationRows(created.id, input));
      return created.id;
    });
    res.status(201).json({ book: await load(id) });
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
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another book already uses this address" } });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(books)
        .set({ ...columns(input), updatedAt: new Date() })
        .where(eq(books.id, existing.id));
      await tx.delete(bookTranslations).where(eq(bookTranslations.bookId, existing.id));
      await tx.insert(bookTranslations).values(bookTranslationRows(existing.id, input));
    });
    // A replaced PDF is no longer used anywhere
    if (existing.pdfPublicId && existing.pdfPublicId !== input.pdfPublicId) await media?.destroy(existing.pdfPublicId);
    res.json({ book: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [deleted] = id.success
      ? await db.delete(books).where(eq(books.id, id.data)).returning({ pdfPublicId: books.pdfPublicId })
      : [];
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (deleted.pdfPublicId) await media?.destroy(deleted.pdfPublicId);
    res.status(204).end();
  });

  return router;
}
