import { createHmac, timingSafeEqual } from "node:crypto";
import type { Appointment } from "../db/schema.js";
import { centralClock, toMinutes, toTime } from "./booking.js";
import { describeAppointment } from "./booking-store.js";
import type { Mail } from "./mailer.js";

/**
 * The key in a customer's "manage your booking" link. It is signed from the reference,
 * so it needs no database column and every booking, old or new, has one.
 */
export function manageKey(secret: string, reference: string) {
  return createHmac("sha256", secret).update(`manage-booking:${reference}`).digest("base64url").slice(0, 32);
}

export function manageKeyMatches(secret: string, reference: string, key: unknown) {
  if (typeof key !== "string" || key.length !== 32) return false;
  return timingSafeEqual(Buffer.from(manageKey(secret, reference)), Buffer.from(key));
}

/** The page where the customer can see, move or cancel their booking. */
export function manageUrl(siteUrl: string, secret: string, a: Pick<Appointment, "reference" | "locale">) {
  const query = new URLSearchParams({ ref: a.reference, key: manageKey(secret, a.reference) });
  return `${siteUrl.replace(/\/$/, "")}/${a.locale ?? "en"}/book/manage?${query}`;
}

/** A US Central date and "HH:MM" as the real moment it happens. */
export function centralToUtc(date: string, time: string) {
  const wall = new Date(`${date}T${time.slice(0, 5)}:00Z`).getTime();
  let guess = wall;
  // Twice, so a guess on the far side of a daylight-saving change settles
  for (let i = 0; i < 2; i++) {
    const seen = centralClock(new Date(guess));
    const seenWall = new Date(`${seen.date}T${toTime(seen.minutes)}:00Z`).getTime();
    guess += wall - seenWall;
  }
  return new Date(guess);
}

/** When the booking starts and ends, as real moments. */
export function bookingMoments(a: Pick<Appointment, "date" | "startTime" | "durationMinutes">) {
  const start = centralToUtc(a.date, a.startTime);
  return { start, end: new Date(start.getTime() + a.durationMinutes * 60_000) };
}

/** Whether the customer may still move or cancel it themselves: an open booking, before the notice period. */
export function customerCanChange(
  a: Pick<Appointment, "status" | "date" | "startTime">,
  minNoticeHours: number,
  now: Date,
) {
  if (a.status !== "requested" && a.status !== "confirmed" && a.status !== "rescheduled") return false;
  const cutoff = centralClock(new Date(now.getTime() + minNoticeHours * 3_600_000));
  return a.date > cutoff.date || (a.date === cutoff.date && toMinutes(a.startTime) > cutoff.minutes);
}

const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Commas, semicolons and backslashes are special in calendar text, and lines are folded at 75 bytes
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/** A calendar file (.ics) for the booking, which phones and Outlook open as an event. */
export function bookingIcs(a: Appointment, link?: string, now = new Date()) {
  const { start, end } = bookingMoments(a);
  const description = [describeAppointment(a), link && `Change or cancel: ${link}`].filter(Boolean).join("\n\n");
  const location = a.mode === "zoom" ? a.meetingLink : a.mode === "home_visit" ? a.address : a.mode === "phone" ? "By phone" : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Astro Shantiram//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.reference}@astro-shantiram`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`${a.serviceName} with Astro Shantiram`)}`,
    `DESCRIPTION:${icsText(description)}`,
    location && `LOCATION:${icsText(location)}`,
    a.meetingLink && `URL:${a.meetingLink}`,
    a.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Booking with Astro Shantiram",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => Boolean(l));
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export type BookingLinks = { siteUrl: string; secret: string };

/**
 * An email to the customer about their booking, with the link to manage it and,
 * for a booked time, the calendar file attached.
 */
export function customerMail(
  links: BookingLinks | undefined,
  a: Appointment,
  { subject, opening, calendar = false }: { subject: string; opening: string; calendar?: boolean },
): Mail {
  const link = links && manageUrl(links.siteUrl, links.secret, a);
  const manage = link && `To add it to your calendar, or to move or cancel it: ${link}`;
  return {
    to: a.email,
    subject: `${subject} (${a.reference})`,
    text: [`Namaste ${a.name},`, opening, describeAppointment(a), manage, "Astro Shantiram"].filter(Boolean).join("\n\n"),
    attachments: calendar
      ? [{ filename: `astro-shantiram-${a.reference}.ics`, content: bookingIcs(a, link), contentType: "text/calendar; charset=utf-8" }]
      : undefined,
  };
}
