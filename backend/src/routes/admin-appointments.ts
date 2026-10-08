import { and, asc, between, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { type Appointment, appointments, blockedDates, bookingSettings, scheduleWindows } from "../db/schema.js";
import { addDays, bookingSettingsSchema, centralClock, scheduleWindowsSchema, toMinutes } from "../services/booking.js";
import { busyBetween, describeAppointment, loadSettings, loadWindows } from "../services/booking-store.js";
import type { Mailer } from "../services/mailer.js";
import type { Zoom } from "../services/zoom.js";

const idParam = z.uuid();
const views = ["requests", "upcoming", "past", "cancelled"] as const;
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

const statusInput = z.object({
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
  notify: z.boolean().default(true),
});
const rescheduleInput = z.object({ date: z.iso.date("Choose a date"), time: clock, notify: z.boolean().default(true) });
const notesInput = z.object({
  meetingLink: z
    .union([z.url({ protocol: /^https?$/, error: "Paste the full link, starting with https://" }), z.literal("")])
    .transform((v) => v || null),
  adminNote: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => v || null),
});

const fieldErrorsOf = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fieldErrors;
};

/** Booking management for the admin dashboard; mount behind requireAuth. */
export function adminAppointmentsRouter({
  db,
  mailer,
  now = () => new Date(),
  zoom,
}: {
  db: Database;
  mailer: Mailer;
  now?: () => Date;
  zoom?: Zoom;
}) {
  const router = Router();

  /**
   * Keeps the website-made Zoom meeting in step with the booking: makes one when a Zoom
   * booking is confirmed without a link, moves it with the booking, and deletes it on cancel.
   * Zoom trouble never blocks the booking change; the admin sees a note instead.
   */
  async function syncZoom(a: Appointment): Promise<{ appointment: Appointment; zoom?: string }> {
    if (!zoom || a.mode !== "zoom") return { appointment: a };
    const details = {
      topic: `${a.serviceName} with Astro Shantiram (${a.reference})`,
      date: a.date,
      startTime: a.startTime,
      durationMinutes: a.durationMinutes,
      agenda: `Booking ${a.reference} for ${a.name}`,
    };
    const save = async (values: Partial<Appointment>) =>
      (await db.update(appointments).set(values).where(eq(appointments.id, a.id)).returning())[0];
    try {
      if (a.status === "cancelled") {
        if (!a.zoomMeetingId) return { appointment: a };
        await zoom.deleteMeeting(a.zoomMeetingId);
        return { appointment: await save({ zoomMeetingId: null, meetingLink: null }), zoom: "The Zoom meeting was deleted." };
      }
      if (a.status !== "confirmed" && a.status !== "rescheduled") return { appointment: a };
      if (a.zoomMeetingId) {
        await zoom.moveMeeting(a.zoomMeetingId, details);
        return { appointment: a };
      }
      // A link the admin pasted themselves is left alone
      if (a.meetingLink) return { appointment: a };
      const meeting = await zoom.createMeeting(details);
      return { appointment: await save({ zoomMeetingId: meeting.id, meetingLink: meeting.joinUrl }), zoom: "A Zoom meeting was created." };
    } catch (err) {
      console.error("Zoom update failed", a.reference, err);
      const detail = err instanceof Error ? err.message : "Unknown error";
      return { appointment: a, zoom: `Zoom problem: ${detail.slice(0, 300)}. You can paste a meeting link by hand below.` };
    }
  }

  async function tellCustomer(a: Appointment, subject: string, opening: string) {
    await mailer
      .send({ to: a.email, subject: `${subject} (${a.reference})`, text: `Namaste ${a.name},\n\n${opening}\n\n${describeAppointment(a)}\n\nAstro Shantiram` })
      .catch((err) => console.error("Failed to email the customer", err));
  }

  router.get("/", async (req, res) => {
    const view = z.enum(views).catch("requests").parse(req.query.view);
    const today = centralClock(now()).date;
    const where = {
      requests: eq(appointments.status, "requested"),
      upcoming: and(inArray(appointments.status, ["confirmed", "rescheduled"]), gte(appointments.date, today)),
      past: and(ne(appointments.status, "cancelled"), ne(appointments.status, "requested"), lt(appointments.date, today)),
      cancelled: eq(appointments.status, "cancelled"),
    }[view];
    const newestFirst = view === "past" || view === "cancelled";
    const [rows, [requests], [todayCount]] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(newestFirst ? desc(appointments.date) : asc(appointments.date), newestFirst ? desc(appointments.startTime) : asc(appointments.startTime))
        .limit(200),
      db.select({ n: count() }).from(appointments).where(eq(appointments.status, "requested")),
      db
        .select({ n: count() })
        .from(appointments)
        .where(and(eq(appointments.date, today), inArray(appointments.status, ["requested", "confirmed", "rescheduled"]))),
    ]);
    res.json({ view, today, appointments: rows, counts: { requests: requests.n, today: todayCount.n } });
  });

  // Bookings, days off and weekly hours for a stretch of days, for the calendar
  router.get("/calendar", async (req, res) => {
    const today = centralClock(now()).date;
    const from = z.iso.date().catch(today).parse(req.query.from);
    const days = z.coerce.number().int().min(1).max(42).catch(7).parse(req.query.days);
    const to = addDays(from, days - 1);
    const [rows, blocked, windows] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(and(between(appointments.date, from, to), ne(appointments.status, "cancelled")))
        .orderBy(asc(appointments.date), asc(appointments.startTime)),
      db.select().from(blockedDates).where(between(blockedDates.date, from, to)).orderBy(asc(blockedDates.date)),
      loadWindows(db),
    ]);
    res.json({
      from,
      to,
      today,
      appointments: rows,
      blocked,
      windows: windows.map((w) => ({ ...w, startTime: w.startTime.slice(0, 5), endTime: w.endTime.slice(0, 5) })),
    });
  });

  router.get("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const [row] = id.success ? await db.select().from(appointments).where(eq(appointments.id, id.data)) : [];
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ appointment: row });
  });

  router.post("/:id/status", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = statusInput.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    let [row] = await db
      .update(appointments)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(appointments.id, id.data))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const synced = await syncZoom(row);
    row = synced.appointment;
    if (parsed.data.notify && parsed.data.status === "confirmed") {
      await tellCustomer(row, "Your booking is confirmed", "Your booking with Guruji is confirmed. We look forward to seeing you.");
    }
    if (parsed.data.notify && parsed.data.status === "cancelled") {
      await tellCustomer(row, "Your booking is cancelled", "Your booking has been cancelled. Please reply to this email or contact us to choose another time.");
    }
    res.json({ appointment: row, zoom: synced.zoom });
  });

  router.post("/:id/reschedule", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = rescheduleInput.safeParse(req.body);
    if (!id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const { date, time, notify } = parsed.data;
    const [existing] = await db.select().from(appointments).where(eq(appointments.id, id.data));
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    // The admin may book outside the schedule, but not on top of another booking
    const start = toMinutes(time);
    const clash = ((await busyBetween(db, date, date, existing.id)).get(date) ?? []).some((b) => {
      const other = toMinutes(b.startTime);
      return start < other + b.durationMinutes && start + existing.durationMinutes > other;
    });
    if (clash) {
      res.status(409).json({ error: "time_taken", fieldErrors: { time: "Another booking is already at this time" } });
      return;
    }
    const [row] = await db
      .update(appointments)
      .set({ date, startTime: time, status: "rescheduled", reminderSentAt: null, updatedAt: new Date() })
      .where(eq(appointments.id, existing.id))
      .returning();
    const synced = await syncZoom(row);
    if (notify) await tellCustomer(synced.appointment, "Your booking has a new time", "Your booking has been moved to a new time. The details are below.");
    res.json({ appointment: synced.appointment, zoom: synced.zoom });
  });

  router.patch("/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = notesInput.safeParse(req.body);
    if (!id.success) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const [row] = await db
      .update(appointments)
      .set({
        ...parsed.data,
        // A different link replaces the website's Zoom meeting, so stop moving that one with the booking
        zoomMeetingId: sql`case when ${appointments.meetingLink} is distinct from ${parsed.data.meetingLink} then null else ${appointments.zoomMeetingId} end`,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id.data))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ appointment: row });
  });

  return router;
}

const blockedInput = z.object({
  date: z.iso.date("Choose a date"),
  reason: z
    .string()
    .trim()
    .max(200)
    .default("")
    .transform((v) => v || null),
});

/** The weekly hours, booking rules and days off; mount behind requireAuth. */
export function adminScheduleRouter({ db, now = () => new Date() }: { db: Database; now?: () => Date }) {
  const router = Router();

  async function current() {
    const today = centralClock(now()).date;
    const [settings, windows, blocked] = await Promise.all([
      loadSettings(db),
      loadWindows(db),
      db.select().from(blockedDates).where(gte(blockedDates.date, today)).orderBy(asc(blockedDates.date)),
    ]);
    return {
      settings,
      windows: windows.map((w) => ({ ...w, startTime: w.startTime.slice(0, 5), endTime: w.endTime.slice(0, 5) })),
      blocked,
    };
  }

  router.get("/", async (_req, res) => {
    res.json(await current());
  });

  router.put("/windows", async (req, res) => {
    const parsed = scheduleWindowsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(scheduleWindows);
      if (parsed.data.windows.length) await tx.insert(scheduleWindows).values(parsed.data.windows);
    });
    res.json(await current());
  });

  router.put("/settings", async (req, res) => {
    const parsed = bookingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    await loadSettings(db);
    await db.update(bookingSettings).set({ ...parsed.data, updatedAt: new Date() });
    res.json(await current());
  });

  router.post("/blocked", async (req, res) => {
    const parsed = blockedInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    await db
      .insert(blockedDates)
      .values(parsed.data)
      .onConflictDoUpdate({ target: blockedDates.date, set: { reason: parsed.data.reason } });
    res.status(201).json(await current());
  });

  router.delete("/blocked/:date", async (req, res) => {
    const date = z.iso.date().safeParse(req.params.date);
    if (date.success) await db.delete(blockedDates).where(eq(blockedDates.date, date.data));
    res.json(await current());
  });

  return router;
}
