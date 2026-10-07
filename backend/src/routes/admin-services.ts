import { and, asc, eq, ne } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { services, serviceTranslations } from "../db/schema.js";
import type { Media } from "../services/media.js";
import { type ServiceInput, serviceInputSchema, serviceTranslationRows } from "../services/services.js";

const idParam = z.uuid();

/** Astrology and puja services for the admin dashboard; mount behind requireAuth. */
export function adminServicesRouter({ db, media }: { db: Database; media?: Media }) {
  const router = Router();

  async function slugTaken(slug: string, exceptId?: string) {
    const [row] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.slug, slug), exceptId ? ne(services.id, exceptId) : undefined));
    return Boolean(row);
  }

  function parseInput(body: unknown): { input?: ServiceInput; fieldErrors?: Record<string, string> } {
    const parsed = serviceInputSchema.safeParse(body);
    if (parsed.success) {
      // Only photos uploaded to our own storage, never arbitrary links
      if (parsed.data.imageUrl && !media?.owns(parsed.data.imageUrl)) return { fieldErrors: { imageUrl: "Upload the photo again" } };
      return { input: parsed.data };
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { fieldErrors };
  }

  async function load(id: string) {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    if (!service) return undefined;
    const translations = await db.select().from(serviceTranslations).where(eq(serviceTranslations.serviceId, id));
    return { ...service, translations: Object.fromEntries(translations.map((t) => [t.locale, t])) };
  }

  const columns = (input: ServiceInput) => ({
    slug: input.slug,
    status: input.status,
    category: input.category,
    sortOrder: input.sortOrder,
    priceCents: input.price,
    priceFrom: input.priceFrom,
    durationMinutes: input.durationMinutes,
    modes: input.modes,
    bookingOpen: input.bookingOpen,
    imageUrl: input.imageUrl,
  });

  const slugTakenError = { error: "slug_taken", fieldErrors: { slug: "Another service already uses this address" } };

  router.get("/", async (_req, res) => {
    const [rows, translations] = await Promise.all([
      db.select().from(services).orderBy(asc(services.category), asc(services.sortOrder), asc(services.createdAt)),
      db
        .select({ serviceId: serviceTranslations.serviceId, locale: serviceTranslations.locale, name: serviceTranslations.name })
        .from(serviceTranslations),
    ]);
    res.json({
      services: rows.map((s) => {
        const own = translations.filter((t) => t.serviceId === s.id);
        return { ...s, name: (own.find((t) => t.locale === "en") ?? own[0])?.name ?? s.slug, locales: own.map((t) => t.locale) };
      }),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const service = id.success ? await load(id.data) : undefined;
    if (!service) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ service });
  });

  router.post("/", async (req, res) => {
    const { input, fieldErrors } = parseInput(req.body);
    if (!input) {
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    if (await slugTaken(input.slug)) {
      res.status(409).json(slugTakenError);
      return;
    }
    const id = await db.transaction(async (tx) => {
      const [created] = await tx.insert(services).values(columns(input)).returning({ id: services.id });
      await tx.insert(serviceTranslations).values(serviceTranslationRows(created.id, input));
      return created.id;
    });
    res.status(201).json({ service: await load(id) });
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
      res.status(409).json(slugTakenError);
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({ ...columns(input), updatedAt: new Date() })
        .where(eq(services.id, existing.id));
      await tx.delete(serviceTranslations).where(eq(serviceTranslations.serviceId, existing.id));
      await tx.insert(serviceTranslations).values(serviceTranslationRows(existing.id, input));
    });
    res.json({ service: await load(existing.id) });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [deleted] = id.success ? await db.delete(services).where(eq(services.id, id.data)).returning({ id: services.id }) : [];
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
