import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import type { Mail, Mailer } from "../src/services/mailer.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
const cronSecret = "cron-secret-for-tests";
let db: Database;
let mails: Mail[];
let failFor: string | undefined;

// Monday, October 12, 2026, 10:00 AM in Dallas (CDT is UTC-5)
const now = () => new Date("2026-10-12T15:00:00Z");
const mailer: Mailer = {
  configured: true,
  async send(m) {
    if (m.to === failFor) throw new Error("mail server down");
    mails.push(m);
  },
};
const api = (deps: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({ db, mailer, corsOrigins: [], jwtSecret, cronSecret, now, ...deps });
const runReminders = (app = api()) => request(app).get("/api/cron/reminders").auth(cronSecret, { type: "bearer" });

let n = 0;
const appointment = async (values: Partial<typeof schema.appointments.$inferInsert>) => {
  n++;
  const [row] = await db
    .insert(schema.appointments)
    .values({
      reference: `AS-T${String(n).padStart(5, "0")}`,
      serviceName: "Kundali reading",
      kind: "consultation",
      date: "2026-10-13",
      startTime: "18:00",
      durationMinutes: 60,
      mode: "zoom",
      language: "en",
      status: "confirmed",
      name: "Sita Sharma",
      email: `person${n}@example.com`,
      phone: "214-555-0100",
      ...values,
    })
    .returning();
  return row;
};

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.appointments);
  mails = [];
  failFor = undefined;
});

describe("booking reminders", () => {
  it("only runs for Vercel's secret", async () => {
    expect((await request(api()).get("/api/cron/reminders")).status).toBe(401);
    expect((await request(api()).get("/api/cron/reminders").auth("wrong", { type: "bearer" })).status).toBe(401);
    expect((await runReminders(api({ cronSecret: undefined }))).status).toBe(503);
  });

  it("does nothing until email is set up", async () => {
    await appointment({});
    const res = await runReminders(api({ mailer: { configured: false, async send() {} } }));
    expect(res.status).toBe(503);
    const [row] = await db.select().from(schema.appointments);
    expect(row.reminderSentAt).toBeNull();
  });

  it("reminds confirmed bookings for tomorrow and later today, once", async () => {
    const tomorrow = await appointment({ meetingLink: "https://zoom.us/j/123" });
    const moved = await appointment({ status: "rescheduled", date: "2026-10-12", startTime: "17:00" });
    await appointment({ status: "requested" });
    await appointment({ status: "cancelled" });
    await appointment({ date: "2026-10-12", startTime: "09:00" }); // already over
    await appointment({ date: "2026-10-14" }); // the day after tomorrow

    const res = await runReminders();
    expect(res.body).toEqual({ date: "2026-10-12", sent: 2, failed: 0 });
    expect(mails.map((m) => [m.to, m.subject])).toEqual(
      expect.arrayContaining([
        [tomorrow.email, `Reminder: your booking is tomorrow (${tomorrow.reference})`],
        [moved.email, `Reminder: your booking is today (${moved.reference})`],
      ]),
    );
    const toTomorrow = mails.find((m) => m.to === tomorrow.email)!;
    expect(toTomorrow.text).toContain("Tuesday, October 13, 2026 at 6:00 PM (US Central)");
    expect(toTomorrow.text).toContain("Meeting link: https://zoom.us/j/123");

    mails = [];
    expect((await runReminders()).body).toMatchObject({ sent: 0 });
    expect(mails).toEqual([]);
  });

  it("tries again next time when sending fails", async () => {
    const a = await appointment({});
    failFor = a.email;
    expect((await runReminders()).body).toMatchObject({ sent: 0, failed: 1 });
    failFor = undefined;
    expect((await runReminders()).body).toMatchObject({ sent: 1, failed: 0 });
  });

  it("reminds again after the booking moves", async () => {
    const a = await appointment({});
    await runReminders();
    const [user] = await db
      .insert(schema.users)
      .values({ email: `m${n}@example.com`, name: "M", passwordHash: "x", role: "appointment_manager" })
      .returning();
    const moved = await request(api())
      .post(`/api/admin/appointments/${a.id}/reschedule`)
      .auth(signToken(user.id, jwtSecret), { type: "bearer" })
      .send({ date: "2026-10-13", time: "19:00", notify: false });
    expect(moved.status).toBe(200);
    const [row] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, a.id));
    expect(row.reminderSentAt).toBeNull();
  });
});
