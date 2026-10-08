import { eq, sql } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { type Appointment, appointments } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { addDays, bookingRange, centralClock, openSlots, pujaDateOpen } from "../services/booking.js";
import {
  type BookingLinks,
  bookingIcs,
  bookingMoments,
  customerCanChange,
  customerMail,
  manageKeyMatches,
  manageUrl,
} from "../services/booking-links.js";
import { blockedBetween, busyBetween, describeAppointment, formatWhen, loadSettings, loadWindows } from "../services/booking-store.js";
import type { Mailer } from "../services/mailer.js";
import type { Zoom } from "../services/zoom.js";
import { syncZoom } from "../services/zoom-sync.js";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");
const moveInput = z.object({ date: z.iso.date("Choose a date"), time: clock });
const availabilityQuery = z.object({ from: z.iso.date().optional(), days: z.coerce.number().int().min(1).max(42).default(35) });

/** What the customer sees about their own booking; leaves out the admin's notes. */
function forCustomer(a: Appointment, canChange: boolean) {
  const { start, end } = bookingMoments(a);
  return {
    reference: a.reference,
    serviceName: a.serviceName,
    kind: a.kind,
    date: a.date,
    time: a.startTime.slice(0, 5),
    durationMinutes: a.durationMinutes,
    mode: a.mode,
    language: a.language,
    status: a.status,
    name: a.name,
    address: a.address,
    meetingLink: a.meetingLink,
    canChange,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * The customer's own booking, reached from the link in their emails. The link's key is
 * signed from the reference, so only someone with the email can see or change it.
 */
export function manageBookingRouter({
  db,
  mailer,
  notifyEmail,
  internalApiKey,
  now = () => new Date(),
  zoom,
  links,
}: {
  db: Database;
  mailer: Mailer;
  notifyEmail?: string;
  internalApiKey?: string;
  now?: () => Date;
  zoom?: Zoom;
  links?: BookingLinks;
}) {
  const router = Router();
  // Wrong keys count against the visitor, so references cannot be guessed at speed
  router.use(visitorRateLimit({ internalApiKey, limit: 60, failuresOnly: true }));

  async function booking(req: Request, res: Response) {
    const key = req.method === "GET" ? req.query.key : req.body?.key;
    const reference = String(req.params.reference ?? "").toUpperCase();
    const [row] =
      links && manageKeyMatches(links.secret, reference, key)
        ? await db.select().from(appointments).where(eq(appointments.reference, reference))
        : [];
    if (!row) res.status(404).json({ error: "not_found" });
    return row;
  }

  async function changeable(a: Appointment) {
    return customerCanChange(a, (await loadSettings(db)).minNoticeHours, now());
  }

  async function tellGuruji(a: Appointment, what: string, extra = "") {
    if (!notifyEmail) return;
    await mailer
      .send({
        to: notifyEmail,
        replyTo: a.email,
        subject: `[Astro Shantiram] ${a.name} ${what} (${a.reference})`,
        text: `${a.name} <${a.email}>, ${a.phone} ${what} using the link in their email.${extra}\n\n${describeAppointment(a)}\n\nSee it in the admin: Appointments.`,
      })
      .catch((err) => console.error("Failed to email Guruji", err));
  }

  router.get("/:reference", async (req, res) => {
    const a = await booking(req, res);
    if (a) res.json({ booking: forCustomer(a, await changeable(a)) });
  });

  router.get("/:reference/calendar.ics", async (req, res) => {
    const a = await booking(req, res);
    if (!a) return;
    res
      .type("text/calendar; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="astro-shantiram-${a.reference}.ics"`)
      .send(bookingIcs(a, links && manageUrl(links.siteUrl, links.secret, a), now()));
  });

  // Open times to move to, counting the booking's own time as free
  router.get("/:reference/availability", async (req, res) => {
    const a = await booking(req, res);
    if (!a) return;
    const parsed = availabilityQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const at = now();
    const settings = await loadSettings(db);
    const { earliest, lastDate } = bookingRange(settings, at);
    const from = parsed.data.from && parsed.data.from > earliest.date ? parsed.data.from : earliest.date;
    const to = addDays(from, parsed.data.days - 1);
    const [windows, blocked, busy] = await Promise.all([loadWindows(db), blockedBetween(db, from, to), busyBetween(db, from, to, a.id)]);
    const days = Array.from({ length: parsed.data.days }, (_, i) => addDays(from, i)).map((date) => {
      if (a.kind === "puja") return { date, open: pujaDateOpen(date, settings, blocked.has(date), at) };
      const slots = openSlots({ date, durationMinutes: a.durationMinutes, settings, windows, busy: busy.get(date) ?? [], blocked: blocked.has(date), now: at });
      return { date, open: slots.length > 0, slots };
    });
    res.json({ kind: a.kind, durationMinutes: a.durationMinutes, modes: [a.mode], earliest: earliest.date, lastDate, today: centralClock(at).date, days });
  });

  router.post("/:reference/cancel", async (req, res) => {
    const a = await booking(req, res);
    if (!a) return;
    if (!(await changeable(a))) {
      res.status(409).json({ error: "too_late" });
      return;
    }
    const [cancelled] = await db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(appointments.id, a.id))
      .returning();
    const { appointment } = await syncZoom(db, zoom, cancelled);
    await Promise.all([
      mailer
        .send(customerMail(links, appointment, { subject: "Your booking is cancelled", opening: "As you asked, your booking has been cancelled. You are welcome to book again any time." }))
        .catch((err) => console.error("Failed to email the customer", err)),
      tellGuruji(appointment, "cancelled their booking"),
    ]);
    res.json({ booking: forCustomer(appointment, false) });
  });

  router.post("/:reference/move", async (req, res) => {
    const a = await booking(req, res);
    if (!a) return;
    const parsed = moveInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    if (!(await changeable(a))) {
      res.status(409).json({ error: "too_late" });
      return;
    }
    const { date, time } = parsed.data;
    const at = now();

    const moved = await db.transaction(async (tx) => {
      // The same lock new bookings take, so a move and a new booking cannot share a time
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${date}`}))`);
      const settings = await loadSettings(tx);
      const blocked = (await blockedBetween(tx, date, date)).has(date);
      if (a.kind === "puja") {
        if (!pujaDateOpen(date, settings, blocked, at)) return null;
      } else {
        const busy = (await busyBetween(tx, date, date, a.id)).get(date) ?? [];
        const slots = openSlots({ date, durationMinutes: a.durationMinutes, settings, windows: await loadWindows(tx), busy, blocked, now: at });
        if (!slots.includes(time)) return null;
      }
      // A consultation moved into Guruji's open hours stays booked; a puja goes back for Guruji to arrange
      const status = a.kind === "puja" || a.status === "requested" ? "requested" : "rescheduled";
      const [row] = await tx
        .update(appointments)
        .set({ date, startTime: time, status, reminderSentAt: null, updatedAt: new Date() })
        .where(eq(appointments.id, a.id))
        .returning();
      return row;
    });
    if (!moved) {
      res.status(409).json({ error: "time_taken" });
      return;
    }

    const { appointment } = await syncZoom(db, zoom, moved);
    const booked = appointment.status === "rescheduled";
    const opening = booked
      ? "Your booking has been moved to the new time you chose. The details are below."
      : "We received your new time. Guruji will confirm it soon.";
    const previously = `\n\nIt was: ${formatWhen(a.date, a.startTime)}`;
    await Promise.all([
      mailer
        .send(customerMail(links, appointment, { subject: "Your booking has a new time", opening, calendar: booked }))
        .catch((err) => console.error("Failed to email the customer", err)),
      tellGuruji(appointment, booked ? "moved their booking" : "asked for a new time", previously),
    ]);
    res.json({ booking: forCustomer(appointment, await changeable(appointment)) });
  });

  return router;
}
