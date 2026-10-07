import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import {
  contentLocales,
  type ContentLocale,
  horoscopeEditions,
  horoscopeEditionTranslations,
  horoscopeReadings,
  zodiacSigns,
} from "../db/schema.js";
import { todayLocal } from "../services/events.js";
import { calendarPeriods, coversToday } from "../services/horoscopes.js";
import { pickTranslation } from "../services/translations.js";

const currentQuery = z.object({
  period: z.enum(calendarPeriods).default("daily"),
  locale: z.enum(contentLocales).default("en"),
});
const localeQuery = z.object({ locale: z.enum(contentLocales).default("en") });

type Edition = typeof horoscopeEditions.$inferSelect;

/** Published horoscopes for the public Horoscope page. */
export function horoscopesRouter({ db, today = todayLocal }: { db: Database; today?: () => string }) {
  const router = Router();

  /** The edition with its title and every sign's reading, each in the best available language. */
  async function present(edition: Edition, locale: ContentLocale) {
    const [translations, readings] = await Promise.all([
      db.select().from(horoscopeEditionTranslations).where(eq(horoscopeEditionTranslations.editionId, edition.id)),
      db.select().from(horoscopeReadings).where(eq(horoscopeReadings.editionId, edition.id)),
    ]);
    const t = pickTranslation(translations.filter((t) => t.title || t.intro), locale);
    return {
      id: edition.id,
      period: edition.period,
      startsOn: edition.startsOn,
      covers: coversToday(edition.period, edition.startsOn, today()),
      title: t?.title ?? null,
      intro: t?.intro ?? null,
      titleLocale: t?.locale ?? null,
      readings: zodiacSigns.flatMap((sign) => {
        const r = pickTranslation(readings.filter((r) => r.sign === sign), locale);
        if (!r) return [];
        const { editionId: _, ...reading } = r;
        return [reading];
      }),
    };
  }

  // The latest daily, weekly, monthly or yearly horoscope that has begun
  router.get("/current", async (req, res) => {
    const parsed = currentQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { period, locale } = parsed.data;
    const [edition] = await db
      .select()
      .from(horoscopeEditions)
      .where(and(eq(horoscopeEditions.period, period), eq(horoscopeEditions.status, "published"), lte(horoscopeEditions.startsOn, today())))
      .orderBy(desc(horoscopeEditions.startsOn))
      .limit(1);
    res.json({ edition: edition ? await present(edition, locale) : null });
  });

  // Festival horoscopes and special astrology updates, newest first
  router.get("/specials", async (req, res) => {
    const parsed = localeQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const editions = await db
      .select()
      .from(horoscopeEditions)
      .where(and(inArray(horoscopeEditions.period, ["festival", "special"]), eq(horoscopeEditions.status, "published")))
      .orderBy(desc(horoscopeEditions.startsOn))
      .limit(10);
    const titles = editions.length
      ? await db.select().from(horoscopeEditionTranslations).where(inArray(horoscopeEditionTranslations.editionId, editions.map((e) => e.id)))
      : [];
    res.json({
      specials: editions.flatMap((e) => {
        const t = pickTranslation(titles.filter((t) => t.editionId === e.id && t.title), parsed.data.locale);
        return t ? [{ id: e.id, period: e.period, startsOn: e.startsOn, title: t.title, titleLocale: t.locale }] : [];
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const parsed = localeQuery.safeParse(req.query);
    const id = z.uuid().safeParse(req.params.id);
    if (!parsed.success || !id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [edition] = await db
      .select()
      .from(horoscopeEditions)
      .where(and(eq(horoscopeEditions.id, id.data), eq(horoscopeEditions.status, "published")));
    if (!edition) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ edition: await present(edition, parsed.data.locale) });
  });

  return router;
}
