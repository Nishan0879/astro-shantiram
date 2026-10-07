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

export function timeRange(start: string | null, end: string | null) {
  if (!start) return null;
  return end ? `${start} – ${end}` : start;
}
