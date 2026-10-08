import { and, asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contentLocales, serviceCategories, services, serviceTranslations } from "../db/schema.js";
import { pickTranslation } from "../services/translations.js";

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  category: z.enum(serviceCategories).optional(),
});

const detailQuery = z.object({ locale: z.enum(contentLocales).default("en") });

/** Published services, in the order the admin set within each category. */
export function servicesRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, category } = parsed.data;
    const rows = await db
      .select()
      .from(services)
      .where(and(eq(services.status, "published"), category ? eq(services.category, category) : undefined))
      .orderBy(asc(services.category), asc(services.sortOrder), asc(services.createdAt));
    const translations = rows.length
      ? await db
          .select({
            serviceId: serviceTranslations.serviceId,
            locale: serviceTranslations.locale,
            name: serviceTranslations.name,
            summary: serviceTranslations.summary,
          })
          .from(serviceTranslations)
          .where(inArray(serviceTranslations.serviceId, rows.map((r) => r.id)))
      : [];

    const list = rows.flatMap((s) => {
      const t = pickTranslation(translations.filter((t) => t.serviceId === s.id), locale);
      if (!t) return [];
      return [
        {
          slug: s.slug,
          category: s.category,
          priceCents: s.priceCents,
          priceFrom: s.priceFrom,
          durationMinutes: s.durationMinutes,
          modes: s.modes,
          bookingOpen: s.bookingOpen,
          imageUrl: s.imageUrl,
          locale: t.locale,
          name: t.name,
          summary: t.summary,
        },
      ];
    });
    res.json({ services: list });
  });

  router.get("/:slug", async (req, res) => {
    const parsed = detailQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.slug, req.params.slug), eq(services.status, "published")));
    const translations = service
      ? await db.select().from(serviceTranslations).where(eq(serviceTranslations.serviceId, service.id))
      : [];
    const t = pickTranslation(translations, parsed.data.locale);
    if (!service || !t) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { serviceId: _serviceId, ...writing } = t;
    res.json({
      service: {
        slug: service.slug,
        category: service.category,
        priceCents: service.priceCents,
        priceFrom: service.priceFrom,
        durationMinutes: service.durationMinutes,
        modes: service.modes,
        bookingOpen: service.bookingOpen,
        imageUrl: service.imageUrl,
        updatedAt: service.updatedAt,
        ...writing,
      },
    });
  });

  return router;
}
