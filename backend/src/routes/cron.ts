import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { Router } from "express";
import type { Database } from "../db/client.js";
import { appointments } from "../db/schema.js";
import { addDays, centralClock, toTime } from "../services/booking.js";
import { describeAppointment } from "../services/booking-store.js";
import type { Mailer } from "../services/mailer.js";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Scheduled jobs Vercel calls (see vercel.json). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>", so nobody else can trigger them.
 */
export function cronRouter({
  db,
  mailer,
  cronSecret,
  now = () => new Date(),
}: {
  db: Database;
  mailer: Mailer;
  cronSecret?: string;
  now?: () => Date;
}) {
  const router = Router();

  router.use((req, res, next) => {
    if (!cronSecret) {
      res.status(503).json({ error: "cron_not_configured" });
      return;
    }
    if (!timingSafeEqual(digest(req.get("authorization") ?? ""), digest(`Bearer ${cronSecret}`))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  });

  // Emails everyone with a confirmed booking tomorrow (and any later today not yet reminded)
  router.get("/reminders", async (_req, res) => {
    if (mailer.configured === false) {
      res.status(503).json({ error: "email_not_configured" });
      return;
    }
    const clock = centralClock(now());
    const tomorrow = addDays(clock.date, 1);
    const due = await db
      .select()
      .from(appointments)
      .where(
        and(
          inArray(appointments.status, ["confirmed", "rescheduled"]),
          isNull(appointments.reminderSentAt),
          or(eq(appointments.date, tomorrow), and(eq(appointments.date, clock.date), gt(appointments.startTime, toTime(clock.minutes)))),
        ),
      );

    let sent = 0;
    let failed = 0;
    for (const a of due) {
      // Claim it first so two overlapping runs never send the same reminder twice
      const [claimed] = await db
        .update(appointments)
        .set({ reminderSentAt: new Date() })
        .where(and(eq(appointments.id, a.id), isNull(appointments.reminderSentAt)))
        .returning();
      if (!claimed) continue;
      const when = a.date === tomorrow ? "tomorrow" : "today";
      try {
        await mailer.send({
          to: a.email,
          subject: `Reminder: your booking is ${when} (${a.reference})`,
          text: `Namaste ${a.name},\n\nThis is a reminder that your booking with Astro Shantiram is ${when}. The details are below.\n\n${describeAppointment(a)}\n\nIf you need to change the time, please reply to this email or call us.\n\nAstro Shantiram`,
        });
        sent++;
      } catch (err) {
        console.error("Failed to send a booking reminder", a.reference, err);
        // Let the next run try again
        await db.update(appointments).set({ reminderSentAt: null }).where(eq(appointments.id, a.id));
        failed++;
      }
    }
    res.json({ date: clock.date, sent, failed });
  });

  return router;
}
