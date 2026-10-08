import { avg, count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { type Testimonial, testimonials, testimonialStatuses } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { websiteOnly } from "../middleware/website-only.js";
import type { Mailer } from "../services/mailer.js";
import { looksLikeSpam } from "../services/spam.js";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => s || null);

const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .optional();

export const testimonialInputSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  place: optional(80),
  email: z.email("Enter a valid email").max(254),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  service: optional(120),
  message: z.string().trim().min(10, "Please write a little more").max(1500),
  locale: z.enum(["en", "ne", "sa"]).optional(),
});

const fieldErrorsOf = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fieldErrors;
};

/** What visitors see of a review: never the email. */
function forPublic(t: Testimonial) {
  return { id: t.id, name: t.name, place: t.place, rating: t.rating, service: t.service, message: t.message, locale: t.locale, approvedAt: t.approvedAt };
}

/** Reviews from visitors: sending one, and reading the approved ones. */
export function testimonialsRouter({
  db,
  mailer,
  notifyEmail,
  internalApiKey,
}: {
  db: Database;
  mailer: Mailer;
  notifyEmail?: string;
  internalApiKey?: string;
}) {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(100).catch(50).parse(req.query.limit);
    const approved = eq(testimonials.status, "approved");
    const [rows, [summary]] = await Promise.all([
      db
        .select()
        .from(testimonials)
        .where(approved)
        .orderBy(desc(testimonials.featured), desc(testimonials.approvedAt))
        .limit(limit),
      db.select({ count: count(), average: avg(testimonials.rating) }).from(testimonials).where(approved),
    ]);
    res.json({
      testimonials: rows.map(forPublic),
      count: summary.count,
      average: summary.average === null ? null : Math.round(Number(summary.average) * 10) / 10,
    });
  });

  router.post("/", websiteOnly(internalApiKey), visitorRateLimit({ internalApiKey, limit: 5 }), async (req, res) => {
    const parsed = testimonialInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const input = parsed.data;
    const spam = looksLikeSpam({ name: input.name, subject: input.service ?? "", message: input.message });
    const [saved] = await db
      .insert(testimonials)
      .values({ ...input, status: spam ? "spam" : "new" })
      .returning();
    if (notifyEmail && !spam) {
      await mailer
        .send({
          to: notifyEmail,
          replyTo: input.email,
          subject: `[Astro Shantiram] New review from ${input.name} (${input.rating}/5)`,
          text: `${input.name}${input.place ? ` from ${input.place}` : ""} <${input.email}> left a review${input.service ? ` for ${input.service}` : ""}:\n\n${"★".repeat(input.rating)}${"☆".repeat(5 - input.rating)}\n${input.message}\n\nIt shows on the website only after you approve it in the admin: Reviews.`,
        })
        .catch((err) => console.error("Failed to email Guruji about a review", err));
    }
    res.status(201).json({ id: saved.id });
  });

  return router;
}

const updateSchema = z
  .object({
    status: z.enum(testimonialStatuses).optional(),
    featured: z.boolean().optional(),
    // Light corrections, such as a typo or a surname the client asked to leave out
    name: z.string().trim().min(1).max(80).optional(),
    // Left out means unchanged; sent empty means cleared
    place: clearable(80),
    service: clearable(120),
    message: z.string().trim().min(1).max(1500).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change");

/** Reviewing visitors' reviews in the admin; mount behind requireAuth. */
export function adminTestimonialsRouter({ db }: { db: Database }) {
  const router = Router();
  const idParam = z.uuid();

  router.get("/", async (req, res) => {
    const status = z.enum(testimonialStatuses).catch("new").parse(req.query.status);
    const [rows, byStatus] = await Promise.all([
      db.select().from(testimonials).where(eq(testimonials.status, status)).orderBy(desc(testimonials.createdAt)).limit(200),
      db.select({ status: testimonials.status, total: count() }).from(testimonials).groupBy(testimonials.status),
    ]);
    const counts = Object.fromEntries(testimonialStatuses.map((s) => [s, 0])) as Record<string, number>;
    for (const row of byStatus) counts[row.status] = row.total;
    res.json({ status, testimonials: rows, counts });
  });

  router.patch("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const [current] = await db.select().from(testimonials).where(eq(testimonials.id, id.data));
    if (!current) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    const status = parsed.data.status ?? current.status;
    const [updated] = await db
      .update(testimonials)
      .set({
        ...changes,
        // Approval time orders the list; only reviews on the site can be featured
        approvedAt: status === "approved" ? (current.approvedAt ?? new Date()) : current.approvedAt,
        featured: status === "approved" ? (parsed.data.featured ?? current.featured) : false,
      })
      .where(eq(testimonials.id, id.data))
      .returning();
    res.json({ testimonial: updated });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (id.success) await db.delete(testimonials).where(eq(testimonials.id, id.data));
    res.status(204).end();
  });

  return router;
}
