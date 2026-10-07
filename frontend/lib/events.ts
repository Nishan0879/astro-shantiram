import type { ContentLocale } from "./articles";

export type EventSummary = {
  slug: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  registrationUrl: string | null;
  youtubeUrl: string | null;
  zoomUrl: string | null;
  locale: ContentLocale;
  name: string;
  location: string | null;
};

export type PublicEvent = EventSummary & { description: string | null; isPast: boolean };

export type EventList = { events: EventSummary[]; total: number; page: number; pageSize: number };

/** "2099-02-20" as a Date at midnight UTC; format it with timeZone "UTC" so the day never shifts. */
export function eventDay(eventDate: string) {
  return new Date(`${eventDate}T00:00:00Z`);
}

/** "18:30" or "18:30:00" as "6:30 PM" (English) or the locale's own clock style. */
export function formatTime(time: string, locale = "en-US") {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, h, m));
}

export function timeRange(start: string | null, end: string | null, locale = "en-US") {
  if (!start) return null;
  return end ? `${formatTime(start, locale)} – ${formatTime(end, locale)}` : formatTime(start, locale);
}
