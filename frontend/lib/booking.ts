// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ServiceMode } from "./services";

export const appointmentLanguages = ["en", "ne", "hi", "sa"] as const;
export type AppointmentLanguage = (typeof appointmentLanguages)[number];

export const appointmentStatuses = ["requested", "confirmed", "rescheduled", "cancelled", "completed", "no_show"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export type AvailabilityDay = { date: string; open: boolean; slots?: string[] };

export type Availability = {
  kind: "consultation" | "puja";
  durationMinutes: number;
  modes: ServiceMode[];
  earliest: string;
  lastDate: string;
  today: string;
  days: AvailabilityDay[];
};

export type Appointment = {
  id: string;
  reference: string;
  serviceId: string | null;
  serviceName: string;
  kind: "consultation" | "puja";
  date: string;
  startTime: string;
  durationMinutes: number;
  priceCents: number | null;
  mode: ServiceMode;
  language: AppointmentLanguage;
  status: AppointmentStatus;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  gotra: string | null;
  familyNames: string | null;
  notes: string | null;
  meetingLink: string | null;
  zoomMeetingId: string | null;
  adminNote: string | null;
  reminderSentAt: string | null;
  locale: string | null;
  createdAt: string;
};

/** A Central date and "HH:MM" as a Date whose UTC fields hold that wall-clock time, for formatting with timeZone "UTC". */
export const wallClock = (date: string, time = "12:00") => new Date(`${date}T${time.slice(0, 5)}:00Z`);

export const addDays = (iso: string, days: number) => {
  const d = wallClock(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
