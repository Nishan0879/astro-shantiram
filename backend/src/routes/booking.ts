import { and, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { appointments, services, serviceTranslations } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { websiteOnly } from "../middleware/website-only.js";
import {
  addDays,
  bookingInputSchema,
  bookingRange,
  centralClock,
  newReference,
  openSlots,
  pujaDateOpen,
} from "../services/booking.js";
import { blockedBetween, busyBetween, describeAppointment, loadSettings, loadWindows } from "../services/booking-store.js";
import { type BookingLinks, customerMail, manageKey } from "../services/booking-links.js";
import type { Mailer } from "../services/mailer.js";
import { pickTranslation } from "../services/translations.js";

type Deps = { db: Database; mailer: Mailer; notifyEmail?: string; internalApiKey?: string; now?: () => Date; links?: BookingLinks };

const availabilityQuery = z.object({
  service: z.string().trim().min(1).max(120),
  from: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(42).default(35),
});

/** Open times and new bookings for visitors. */
export function bookingRouter({ db, mailer, notifyEmail, internalApiKey, now = () => new Date(), links }: Deps) {
  const router = Router();

  async function bookableService(slug: string) {
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.slug, slug), eq(services.status, "published"), eq(services.bookingOpen, true)));
    if (!service) return undefined;
    const translations = await db.select().from(serviceTranslations).where(eq(serviceTranslations.serviceId, service.id));
    return { ...service, name: pickTranslation(translations, "en")?.name ?? service.slug };
  }

  router.get("/availability", async (req, res) => {
    const parsed = availabilityQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const service = await bookableService(parsed.data.service);
    if (!service) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const at = now();
    const settings = await loadSettings(db);
    const { earliest, lastDate } = bookingRange(settings, at);
    const from = parsed.data.from && parsed.data.from > earliest.date ? parsed.data.from : earliest.date;
    const to = addDays(from, parsed.data.days - 1);
    const [windows, blocked, busy] = await Promise.all([loadWindows(db), blockedBetween(db, from, to), busyBetween(db, from, to)]);
    const durationMinutes = service.durationMinutes ?? settings.defaultDurationMinutes;
    const kind = service.category === "puja" ? "puja" : "consultation";

    const days = Array.from({ length: parsed.data.days }, (_, i) => addDays(from, i)).map((date) => {
      if (kind === "puja") return { date, open: pujaDateOpen(date, settings, blocked.has(date), at) };
      const slots = openSlots({ date, durationMinutes, settings, windows, busy: busy.get(date) ?? [], blocked: blocked.has(date), now: at });
      return { date, open: slots.length > 0, slots };
    });
    res.json({ kind, durationMinutes, modes: service.modes, earliest: earliest.date, lastDate, today: centralClock(at).date, days });
  });

  router.post("/", websiteOnly(internalApiKey), visitorRateLimit({ internalApiKey, limit: 10 }), async (req, res) => {
    const parsed = bookingInputSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
      res.status(400).json({ error: "validation_failed", fieldErrors });
      return;
    }
    const input = parsed.data;
    const service = await bookableService(input.service);
    if (!service) {
      res.status(409).json({ error: "service_unavailable" });
      return;
    }
    if (!service.modes.includes(input.mode)) {
      res.status(400).json({ error: "validation_failed", fieldErrors: { mode: "Choose how you would like to meet" } });
      return;
    }
    const kind = service.category === "puja" ? "puja" : "consultation";
    const at = now();

    const booked = await db.transaction(async (tx) => {
      // One booking per day at a time, so two visitors cannot take the same time
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${input.date}`}))`);
      const settings = await loadSettings(tx);
      const durationMinutes = service.durationMinutes ?? settings.defaultDurationMinutes;
      const blocked = (await blockedBetween(tx, input.date, input.date)).has(input.date);
      if (kind === "puja") {
        if (!pujaDateOpen(input.date, settings, blocked, at)) return null;
      } else {
        const busy = (await busyBetween(tx, input.date, input.date)).get(input.date) ?? [];
        const slots = openSlots({ date: input.date, durationMinutes, settings, windows: await loadWindows(tx), busy, blocked, now: at });
        if (!slots.includes(input.time)) return null;
      }
      const [row] = await tx
        .insert(appointments)
        .values({
          reference: newReference(),
          serviceId: service.id,
          serviceName: service.name,
          kind,
          date: input.date,
          startTime: input.time,
          durationMinutes,
          priceCents: service.priceCents,
          mode: input.mode,
          language: input.language,
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          gotra: input.gotra,
          familyNames: input.familyNames,
          notes: input.notes,
          locale: input.locale,
        })
        .returning();
      return row;
    });

    if (!booked) {
      res.status(409).json({ error: "time_taken" });
      return;
    }

    // The booking is saved, so a mail failure must not fail the request
    const details = describeAppointment(booked);
    const mails = [
      mailer.send(
        customerMail(links, booked, {
          subject: `We received your ${kind === "puja" ? "puja request" : "booking"}`,
          opening: `Thank you. We received your ${kind === "puja" ? "puja request" : "booking request"} and will confirm it soon.`,
        }),
      ),
    ];
    if (notifyEmail) {
      mails.push(
        mailer.send({
          to: notifyEmail,
          replyTo: booked.email,
          subject: `[Astro Shantiram] New ${kind === "puja" ? "puja request" : "booking"}: ${booked.serviceName}`,
          text: `${booked.name} <${booked.email}>, ${booked.phone}\n\n${details}${booked.gotra ? `\nGotra: ${booked.gotra}` : ""}${
            booked.familyNames ? `\nFamily names: ${booked.familyNames}` : ""
          }${booked.notes ? `\n\nNotes:\n${booked.notes}` : ""}\n\nConfirm it in the admin: Appointments.`,
        }),
      );
    }
    await Promise.allSettled(mails).then((results) =>
      results.forEach((r) => r.status === "rejected" && console.error("Failed to send booking email", r.reason)),
    );

    res.status(201).json({
      reference: booked.reference,
      kind,
      date: booked.date,
      time: booked.startTime.slice(0, 5),
      // Lets the thank-you page link to the manage page straight away
      manageKey: links ? manageKey(links.secret, booked.reference) : null,
    });
  });

  return router;
}
