import { randomInt } from "node:crypto";
import { z } from "zod";
import { usPhone } from "./phone.js";
import { appointmentLanguages, type BookingSettings, contentLocales, serviceModes } from "../db/schema.js";

export const SITE_TIME_ZONE = "America/Chicago";

/** "17:00:00" or "17:00" → minutes after midnight. */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes after midnight → "HH:MM". */
export const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The date and clock time in US Central at this moment. */
export function centralClock(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SITE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export type Window = { weekday: number; startTime: string; endTime: string };
export type Busy = { startTime: string; durationMinutes: number };

/** The first and last moments visitors may book, as Central dates and times. */
export function bookingRange(settings: Pick<BookingSettings, "minNoticeHours" | "maxDaysAhead">, now: Date) {
  const earliest = centralClock(new Date(now.getTime() + settings.minNoticeHours * 3_600_000));
  const lastDate = addDays(centralClock(now).date, settings.maxDaysAhead);
  return { earliest, lastDate };
}

/** Start times on one day that fit a consultation of this length around the bookings already made. */
export function openSlots({
  date,
  durationMinutes,
  settings,
  windows,
  busy,
  blocked,
  now,
}: {
  date: string;
  durationMinutes: number;
  settings: BookingSettings;
  windows: Window[];
  busy: Busy[];
  blocked: boolean;
  now: Date;
}): string[] {
  const { earliest, lastDate } = bookingRange(settings, now);
  if (blocked || date < earliest.date || date > lastDate) return [];
  if (settings.maxPerDay !== null && busy.length >= settings.maxPerDay) return [];

  const taken = busy.map((b) => {
    const start = toMinutes(b.startTime);
    return { start: start - settings.bufferMinutes, end: start + b.durationMinutes + settings.bufferMinutes };
  });
  const slots = new Set<number>();
  for (const w of windows.filter((w) => w.weekday === weekdayOf(date))) {
    const end = toMinutes(w.endTime);
    for (let t = toMinutes(w.startTime); t + durationMinutes <= end; t += settings.slotStepMinutes) {
      if (date === earliest.date && t < earliest.minutes) continue;
      if (taken.some((b) => t < b.end && t + durationMinutes > b.start)) continue;
      slots.add(t);
    }
  }
  return [...slots].sort((a, b) => a - b).map(toTime);
}

/** Whether a puja may be requested for this day: not blocked, and within the booking range. */
export function pujaDateOpen(date: string, settings: BookingSettings, blocked: boolean, now: Date) {
  const { earliest, lastDate } = bookingRange(settings, now);
  return !blocked && date >= earliest.date && date <= lastDate;
}

// No 0/O or 1/I, so the code reads back clearly over the phone
const REFERENCE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newReference = () => `AS-${Array.from({ length: 6 }, () => REFERENCE_LETTERS[randomInt(REFERENCE_LETTERS.length)]).join("")}`;

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v || null);

export const bookingInputSchema = z
  .object({
    service: z.string().trim().min(1).max(120),
    date: z.iso.date({ error: "Choose a date" }),
    time: clock,
    mode: z.enum(serviceModes, { error: "Choose how you would like to meet" }),
    language: z.enum(appointmentLanguages).default("en"),
    name: z.string().trim().min(1, "Add your name").max(120),
    email: z.email("Add a valid email").max(254),
    phone: usPhone,
    address: optionalText(300),
    gotra: optionalText(100),
    familyNames: optionalText(2000),
    notes: optionalText(3000),
    locale: z.enum(contentLocales).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "home_visit" && !input.address) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Add the address for the visit" });
    }
  });

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const scheduleWindowsSchema = z.object({
  windows: z
    .array(
      z
        .object({ weekday: z.number().int().min(0).max(6), startTime: clock, endTime: clock })
        .refine((w) => toMinutes(w.endTime) > toMinutes(w.startTime), { message: "End after the start", path: ["endTime"] }),
    )
    .max(50),
});

export const bookingSettingsSchema = z.object({
  slotStepMinutes: z.number().int().min(5).max(240),
  defaultDurationMinutes: z.number().int().min(5).max(24 * 60),
  bufferMinutes: z.number().int().min(0).max(240),
  maxPerDay: z.number().int().min(1).max(100).nullable(),
  minNoticeHours: z.number().int().min(0).max(24 * 30),
  maxDaysAhead: z.number().int().min(1).max(365),
});
