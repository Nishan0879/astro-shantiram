import { and, asc, between, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { activeStatuses, type Appointment, appointments, blockedDates, bookingSettings, scheduleWindows } from "../db/schema.js";
import { type Busy, type Window } from "./booking.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;

export async function loadSettings(db: Db) {
  const [row] = await db.select().from(bookingSettings).where(eq(bookingSettings.id, 1));
  if (row) return row;
  // The migration adds the row; this covers a database where it was removed
  const [created] = await db.insert(bookingSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(bookingSettings).where(eq(bookingSettings.id, 1)))[0];
}

export async function loadWindows(db: Db): Promise<Window[]> {
  return db
    .select({ weekday: scheduleWindows.weekday, startTime: scheduleWindows.startTime, endTime: scheduleWindows.endTime })
    .from(scheduleWindows)
    .orderBy(asc(scheduleWindows.weekday), asc(scheduleWindows.startTime));
}

export async function blockedBetween(db: Db, from: string, to: string) {
  const rows = await db.select({ date: blockedDates.date }).from(blockedDates).where(between(blockedDates.date, from, to));
  return new Set(rows.map((r) => r.date));
}

/** Bookings that still hold time, by date, optionally leaving one out (the one being moved). */
export async function busyBetween(db: Db, from: string, to: string, exceptId?: string) {
  const rows = await db
    .select({ date: appointments.date, startTime: appointments.startTime, durationMinutes: appointments.durationMinutes })
    .from(appointments)
    .where(
      and(
        between(appointments.date, from, to),
        inArray(appointments.status, [...activeStatuses]),
        exceptId ? ne(appointments.id, exceptId) : undefined,
      ),
    );
  const byDate = new Map<string, Busy[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  return byDate;
}

/** "Monday, October 12, 2026 at 5:30 PM (US Central)" */
export function formatWhen(date: string, time: string) {
  const at = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(at);
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
  return `${day} at ${clock} (US Central)`;
}

const modeNames = { in_person: "In person", home_visit: "Home visit", phone: "By phone", zoom: "On Zoom" } as const;
const languageNames = { en: "English", ne: "Nepali", hi: "Hindi", sa: "Sanskrit" } as const;

/** The booking as plain text for emails. */
export function describeAppointment(a: Appointment) {
  return [
    `Reference: ${a.reference}`,
    `Service: ${a.serviceName}`,
    `${a.kind === "puja" ? "Preferred time" : "Time"}: ${formatWhen(a.date, a.startTime)}`,
    `Length: about ${a.durationMinutes} minutes`,
    `How: ${modeNames[a.mode]}`,
    `Language: ${languageNames[a.language]}`,
    a.address && `Address: ${a.address}`,
    a.meetingLink && `Meeting link: ${a.meetingLink}`,
  ]
    .filter(Boolean)
    .join("\n");
}
