import { and, desc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { events, eventTranslations } from "../db/schema.js";
import { type EventInput, eventInputSchema, eventTranslationRows, todayInNepal } from "../services/events.js";

const idParam = z.uuid();

/** Event management for the admin dashboard; mount behind requireAuth. */
export function adminEventsRouter({ db }: { db: Database }) {
  const router = Router();

  async function slugTaken(slug: string, exceptId?: string) {
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.slug, slug), exceptId ? ne(events.id, exceptId) : undefined));
    return Boolean(row);
  }

  function parseInput(body: unknown): { input?: EventInput; fieldErrors?: Record<string, string> } {
    const parsed = eventInputSchema.safeParse(body);
    if (parsed.success) return { input: parsed.data };
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  async function load(id: string) {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) return undefined;
    const translations = await db.select().from(eventTranslations).where(eq(eventTranslations.eventId, id));
    return { ...event, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  const columns = (input: EventInput) => ({
    slug: input.slug,
    status: input.status,
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    registrationUrl: input.registrationUrl,
    youtubeUrl: input.youtubeUrl,
    zoomUrl: input.zoomUrl,
  });

  router.get("/", async (_req, res) => {
    const [rows, translations] = await Promise.all([
      db.select().from(events).orderBy(desc(events.eventDate)),
      db
        .select({ eventId: eventTranslations.eventId, locale: eventTranslations.locale, name: eventTranslations.name })
        .from(eventTranslations),
    ]);
    const today = todayInNepal();
    res.json({
      events: rows.map((e) => {
        const own = translations.filter((t) => t.eventId === e.id);
        return {
          ...e,
          name: (own.find((t) => t.locale === "en") ?? own[0])?.name ?? e.slug,
          locales: own.map((t) => t.locale),
          isUpcoming: e.eventDate >= today,
        };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const event = id.success ? await load(id.data) : undefined;
    if (!event) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ event });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await slugTaken(input.slug)) {
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another event already uses this address" } });
      return;
    }
    const id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(events).values(columns(input)).returning({ id: events.id });
      await tx.insert(eventTranslations).values(eventTranslationRows(created.id, input));
      return created.id;
    });
    res.status(201).json({ event: await load(id) });
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
      res.status(409).json({ error: "slug_taken", fieldErrors: { slug: "Another event already uses this address" } });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(events).set({ ...columns(input), updatedAt: new Date() }).where(eq(events.id, existing.id));
      await tx.delete(eventTranslations).where(eq(eventTranslations.eventId, existing.id));
      await tx.insert(eventTranslations).values(eventTranslationRows(existing.id, input));
    });
    res.json({ event: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const deleted = id.success
      ? await db.delete(events).where(eq(events.id, id.data)).returning({ id: events.id })
      : [];
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
