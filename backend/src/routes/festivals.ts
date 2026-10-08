import { and, asc, between, eq, gte, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contentLocales, events, eventTranslations, type Festival, festivals, festivalTranslations } from "../db/schema.js";
import { todayLocal } from "../services/events.js";
import { pickTranslation } from "../services/translations.js";

const yearQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
const upcomingQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  limit: z.coerce.number().int().min(1).max(12).default(3),
});

/** The published calendar for the public site: Guruji's festival list plus his events. */
export function festivalsRouter({ db, today = todayLocal }: { db: Database; today?: () => string }) {
  const router = Router();

  async function withNames(rows: Festival[], locale: (typeof contentLocales)[number]) {
    const translations = rows.length
      ? await db.select().from(festivalTranslations).where(inArray(festivalTranslations.festivalId, rows.map((r) => r.id)))
      : [];
    return rows.flatMap((f) => {
      const t = pickTranslation(translations.filter((t) => t.festivalId === f.id), locale);
      if (!t) return [];
      return [{ id: f.id, date: f.date, endDate: f.endDate, kind: f.kind, serviceSlug: f.serviceSlug, locale: t.locale, name: t.name, description: t.description }];
    });
  }

  router.get("/", async (req, res) => {
    const parsed = yearQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale } = parsed.data;
    const year = parsed.data.year ?? Number(today().slice(0, 4));
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [rows, eventRows] = await Promise.all([
      db
        .select()
        .from(festivals)
        // A festival that starts in late December still shows in the new year it runs into
        .where(and(eq(festivals.status, "published"), or(between(festivals.date, from, to), between(festivals.endDate, from, to))))
        .orderBy(asc(festivals.date)),
      db.select().from(events).where(and(eq(events.status, "published"), between(events.eventDate, from, to))).orderBy(asc(events.eventDate)),
    ]);
    const eventNames = eventRows.length
      ? await db.select().from(eventTranslations).where(inArray(eventTranslations.eventId, eventRows.map((e) => e.id)))
      : [];
    res.json({
      year,
      today: today(),
      festivals: await withNames(rows, locale),
      events: eventRows.flatMap((e) => {
        const t = pickTranslation(eventNames.filter((t) => t.eventId === e.id), locale);
        return t ? [{ slug: e.slug, date: e.eventDate, startTime: e.startTime?.slice(0, 5) ?? null, locale: t.locale, name: t.name }] : [];
      }),
    });
  });

  // The next few days to count down to, for the home page
  router.get("/upcoming", async (req, res) => {
    const parsed = upcomingQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const now = today();
    const rows = await db
      .select()
      .from(festivals)
      .where(and(eq(festivals.status, "published"), or(gte(festivals.date, now), gte(festivals.endDate, now))))
      .orderBy(asc(festivals.date))
      .limit(parsed.data.limit);
    res.json({ today: now, festivals: await withNames(rows, parsed.data.locale) });
  });

  return router;
}
