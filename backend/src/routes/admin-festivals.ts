import { asc, between, eq, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { festivals, festivalTranslations } from "../db/schema.js";
import { todayLocal } from "../services/events.js";
import { bulkInputSchema, type FestivalInput, festivalInputSchema, festivalTranslationRows, parseFestivalList } from "../services/festivals.js";

const idParam = z.uuid();

const fieldErrorsOf = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fieldErrors;
};

/** The festival calendar for the admin dashboard; mount behind requireAuth. */
export function adminFestivalsRouter({ db, today = todayLocal }: { db: Database; today?: () => string }) {
  const router = Router();

  async function load(id: string) {
    const [festival] = await db.select().from(festivals).where(eq(festivals.id, id));
    if (!festival) return undefined;
    const translations = await db.select().from(festivalTranslations).where(eq(festivalTranslations.festivalId, id));
    return { ...festival, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  const columns = (input: FestivalInput) => ({
    date: input.date,
    endDate: input.endDate,
    kind: input.kind,
    status: input.status,
    serviceSlug: input.serviceSlug,
  });

  router.get("/", async (req, res) => {
    const year = z.coerce.number().int().min(2000).max(2100).catch(Number(today().slice(0, 4))).parse(req.query.year);
    const rows = await db
      .select()
      .from(festivals)
      .where(or(between(festivals.date, `${year}-01-01`, `${year}-12-31`), between(festivals.endDate, `${year}-01-01`, `${year}-12-31`)))
      .orderBy(asc(festivals.date));
    const translations = rows.length
      ? await db
          .select({ festivalId: festivalTranslations.festivalId, locale: festivalTranslations.locale, name: festivalTranslations.name })
          .from(festivalTranslations)
          .where(inArray(festivalTranslations.festivalId, rows.map((r) => r.id)))
      : [];
    res.json({
      year,
      today: today(),
      festivals: rows.map((f) => {
        const own = translations.filter((t) => t.festivalId === f.id);
        return { ...f, name: (own.find((t) => t.locale === "en") ?? own[0])?.name ?? "", locales: own.map((t) => t.locale) };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const festival = id.success ? await load(id.data) : undefined;
    if (!festival) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ festival });
  });

  router.post("/", async (req, res) => {
    const parsed = festivalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(festivals).values(columns(parsed.data)).returning({ id: festivals.id });
      await tx.insert(festivalTranslations).values(festivalTranslationRows(created.id, parsed.data));
      return created.id;
    });
    res.status(201).json({ festival: await load(id) });
  });

  // Many days at once from a pasted list, all of one kind; nothing is saved if any line is wrong
  router.post("/bulk", async (req, res) => {
    const parsed = bulkInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const { days, errors } = parseFestivalList(parsed.data.text);
    if (errors.length || days.length === 0) {
      res.status(400).json({ error: "validation_failed", lines: errors, fieldErrors: days.length ? {} : { text: "Paste at least one line" } });
      return;
    }
    await db.transaction(async (tx) => {
      const created = await tx
        .insert(festivals)
        .values(days.map((d) => ({ date: d.date, kind: parsed.data.kind })))
        .returning({ id: festivals.id });
      await tx.insert(festivalTranslations).values(created.map((c, i) => ({ festivalId: c.id, locale: parsed.data.locale, name: days[i].name })));
    });
    res.status(201).json({ created: days.length });
  });

  router.put("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const existing = id.success ? await load(id.data) : undefined;
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const parsed = festivalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(festivals).set({ ...columns(parsed.data), updatedAt: new Date() }).where(eq(festivals.id, existing.id));
      await tx.delete(festivalTranslations).where(eq(festivalTranslations.festivalId, existing.id));
      await tx.insert(festivalTranslations).values(festivalTranslationRows(existing.id, parsed.data));
    });
    res.json({ festival: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const deleted = id.success ? await db.delete(festivals).where(eq(festivals.id, id.data)).returning({ id: festivals.id }) : [];
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
