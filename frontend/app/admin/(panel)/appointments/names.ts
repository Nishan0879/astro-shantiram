import type { AppointmentLanguage, AppointmentStatus } from "@/lib/booking";
import { wallClock } from "@/lib/booking";

export const statusNames: Record<AppointmentStatus, string> = {
  requested: "Waiting for you",
  confirmed: "Confirmed",
  rescheduled: "Moved",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

export const statusClass: Record<AppointmentStatus, string> = {
  requested: "bg-saffron text-white",
  confirmed: "bg-green-100 text-green-900",
  rescheduled: "bg-green-100 text-green-900",
  cancelled: "bg-charcoal/10 text-charcoal/70",
  completed: "bg-gold/20 text-charcoal",
  no_show: "bg-red-100 text-red-900",
};

export const languageNames: Record<AppointmentLanguage, string> = { en: "English", ne: "Nepali", hi: "Hindi", sa: "Sanskrit" };

/** "Tue, Oct 13 · 6:00 PM" */
export function whenLabel(date: string, time: string) {
  const at = wallClock(date, time);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(at);
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
  return `${day} · ${clock}`;
}
