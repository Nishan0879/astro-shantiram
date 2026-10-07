import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contentLocales, type Event, events, eventTranslations } from "../db/schema.js";
import { todayLocal } from "../services/events.js";
import { pickTranslation } from "../services/translations.js";

const PAGE_SIZE = 12;

const listQuery = z.object({
  locale: z.enum(contentLocales).default("en"),
  when: z.enum(["upcoming", "past"]).default("upcoming"),
  page: z.coerce.number().int().min(1).default(1),
});

const detailQuery = z.object({ locale: z.enum(contentLocales).default("en") });

function publicFields(e: Event) {
  return {
    slug: e.slug,
    eventDate: e.eventDate,
    startTime: e.startTime?.slice(0, 5) ?? null,
    endTime: e.endTime?.slice(0, 5) ?? null,
    registrationUrl: e.registrationUrl,
    youtubeUrl: e.youtubeUrl,
    zoomUrl: e.zoomUrl,
  };
}

/** Published events for the public website. */
export function eventsRouter({ db }: { db: Database }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { locale, when, page } = parsed.data;
    const today = todayLocal();
    const where = and(
      eq(events.status, "published"),
      when === "upcoming" ? gte(events.eventDate, today) : lt(events.eventDate, today),
    );
    // Upcoming: soonest first. Past: most recent first.
    const order =
      when === "upcoming"
        ? [asc(events.eventDate), asc(events.startTime)]
        : [desc(events.eventDate), desc(events.startTime)];

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(events).where(where).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(events).where(where),
    ]);
    const translations = rows.length
      ? await db.select().from(eventTranslations).where(inArray(eventTranslations.eventId, rows.map((r) => r.id)))
      : [];

    const list = rows.flatMap((e) => {
      const t = pickTranslation(translations.filter((t) => t.eventId === e.id), locale);
      if (!t) return [];
      return [{ ...publicFields(e), locale: t.locale, name: t.name, location: t.location }];
    });
    res.json({ events: list, total, page, pageSize: PAGE_SIZE });
  });

  router.get("/:slug", async (req, res) => {
    const parsed = detailQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, req.params.slug), eq(events.status, "published")));
    const translations = event
      ? await db.select().from(eventTranslations).where(eq(eventTranslations.eventId, event.id))
      : [];
    const t = pickTranslation(translations, parsed.data.locale);
    if (!event || !t) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      event: {
        ...publicFields(event),
        isPast: event.eventDate < todayLocal(),
        locale: t.locale,
        name: t.name,
        location: t.location,
        description: t.description,
      },
    });
  });

  return router;
}
