import { count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contentLocales, galleryCategories, galleryItems } from "../db/schema.js";

const PAGE_SIZE = 24;

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  category: z.enum(galleryCategories).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** The public gallery: newest first, each caption in the visitor's language when there is one. */
export function galleryRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, category, page } = parsed.data;
    const where = category ? eq(galleryItems.category, category) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(galleryItems)
        .where(where)
        .orderBy(desc(galleryItems.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(galleryItems).where(where),
    ]);

    const order = [locale, ...contentLocales.filter((l) => l !== locale)];
    const items = rows.map(({ id, kind, category, url, width, height, captions }) => {
      const captionLocale = order.find((l) => captions[l]);
      return {
        id,
        kind,
        category,
        url,
        width,
        height,
        caption: captionLocale ? captions[captionLocale] : null,
        captionLocale: captionLocale ?? null,
      };
    });
    res.json({ items, total, page, pageSize: PAGE_SIZE });
  });

  return router;
}
