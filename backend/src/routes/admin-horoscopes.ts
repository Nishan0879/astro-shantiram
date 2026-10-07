import { and, desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { horoscopeEditions, horoscopeEditionTranslations, horoscopeReadings } from "../db/schema.js";
import { type HoroscopeInput, horoscopeInputSchema, horoscopeRows, isCalendarPeriod } from "../services/horoscopes.js";

const idParam = z.uuid();

const periodNames = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as Record<string, string>;

/** Horoscope writing for the admin dashboard; mount behind requireAuth. */
export function adminHoroscopesRouter({ db }: { db: Database }) {
  const router = Router();

  function parseInput(body: unknown): { input?: HoroscopeInput; fieldErrors?: Record<string, string> } {
    const parsed = horoscopeInputSchema.safeParse(body);
    if (parsed.success) return { input: parsed.data };
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  /** A daily, weekly, monthly or yearly edition that already covers the same span. */
  async function sameSpan(input: HoroscopeInput, exceptId?: string) {
    if (!isCalendarPeriod(input.period)) return undefined;
    const [row] = await db
      .select({ id: horoscopeEditions.id })
      .from(horoscopeEditions)
      .where(
        and(
          eq(horoscopeEditions.period, input.period),
          eq(horoscopeEditions.startsOn, input.startsOn),
          exceptId ? ne(horoscopeEditions.id, exceptId) : undefined,
        ),
      );
    return row?.id;
  }

  const taken = (input: HoroscopeInput, existingId: string) => ({
    error: "already_written",
    existingId,
    fieldErrors: { startsOn: `There is already a horoscope for this ${periodNames[input.period]}` },
  });

  async function load(id: string) {
    const [edition] = await db.select().from(horoscopeEditions).where(eq(horoscopeEditions.id, id));
    if (!edition) return undefined;
    const [translations, readings] = await Promise.all([
      db.select().from(horoscopeEditionTranslations).where(eq(horoscopeEditionTranslations.editionId, id)),
      db.select().from(horoscopeReadings).where(eq(horoscopeReadings.editionId, id)),
    ]);
    const bySign: Record<string, Record<string, unknown>> = {};
    for (const { editionId: _, sign, locale, ...reading } of readings) (bySign[sign] ??= {})[locale] = reading;
    return {
      ...edition,
      translations: Object.fromEntries(translations.map(({ editionId: _, locale, ...t }) => [locale, t])),
      readings: bySign,
    };
  }

  async function write(id: string, input: HoroscopeInput) {
    const { translations, readings } = horoscopeRows(id, input);
    await db.transaction(async (tx) => {
      await tx.delete(horoscopeEditionTranslations).where(eq(horoscopeEditionTranslations.editionId, id));
      await tx.delete(horoscopeReadings).where(eq(horoscopeReadings.editionId, id));
      if (translations.length) await tx.insert(horoscopeEditionTranslations).values(translations);
      if (readings.length) await tx.insert(horoscopeReadings).values(readings);
    });
  }

  router.get("/", async (_req, res) => {
    const [editions, titles, readings] = await Promise.all([
      db.select().from(horoscopeEditions).orderBy(desc(horoscopeEditions.startsOn), desc(horoscopeEditions.createdAt)),
      db.select({ editionId: horoscopeEditionTranslations.editionId, locale: horoscopeEditionTranslations.locale, title: horoscopeEditionTranslations.title }).from(horoscopeEditionTranslations),
      db.select({ editionId: horoscopeReadings.editionId, sign: horoscopeReadings.sign }).from(horoscopeReadings),
    ]);
    res.json({
      editions: editions.map((e) => {
        const own = titles.filter((t) => t.editionId === e.id && t.title);
        return {
          ...e,
          title: (own.find((t) => t.locale === "en") ?? own[0])?.title ?? null,
          signs: new Set(readings.filter((r) => r.editionId === e.id).map((r) => r.sign)).size,
        };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const edition = id.success ? await load(id.data) : undefined;
    if (!edition) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ edition });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    const existing = await sameSpan(input);
    if (existing) {
      res.status(409).json(taken(input, existing));
      return;
    }
    const [created] = await db
      .insert(horoscopeEditions)
      .values({ period: input.period, startsOn: input.startsOn, status: input.status })
      .returning({ id: horoscopeEditions.id });
    await write(created.id, input);
    res.status(201).json({ edition: await load(created.id) });
  });

  router.put("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const current = id.success ? await load(id.data) : undefined;
    if (!current) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    const existing = await sameSpan(input, current.id);
    if (existing) {
      res.status(409).json(taken(input, existing));
      return;
    }
    await db
      .update(horoscopeEditions)
      .set({ period: input.period, startsOn: input.startsOn, status: input.status, updatedAt: new Date() })
      .where(eq(horoscopeEditions.id, current.id));
    await write(current.id, input);
    res.json({ edition: await load(current.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [deleted] = id.success
      ? await db.delete(horoscopeEditions).where(eq(horoscopeEditions.id, id.data)).returning({ id: horoscopeEditions.id })
      : [];
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
