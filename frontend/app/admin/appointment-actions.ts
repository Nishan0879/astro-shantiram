"use server";

import { refresh } from "next/cache";
import { adminFetch } from "@/lib/admin-api";

export type ActionResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; notice?: string };

async function send(path: string, method: string, body: unknown, what: string): Promise<ActionResult> {
  const res = await adminFetch(path, { method, body: JSON.stringify(body) });
  if (res.status === 400 || res.status === 409) {
    const json = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: json.fieldErrors };
  }
  if (res.status === 403) return { error: `Your account is not allowed to ${what}.` };
  if (!res.ok) {
    console.error(`Failed to ${what}`, res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }
  // What happened with the booking's Zoom meeting, if anything
  const { zoom } = (await res.json().catch(() => ({}))) as { zoom?: string };
  refresh();
  return { ok: true, notice: zoom };
}

const appointmentPath = (id: string) => `/api/admin/appointments/${encodeURIComponent(id)}`;

export async function setAppointmentStatus(id: string, status: "confirmed" | "cancelled" | "completed" | "no_show", notify: boolean) {
  return send(`${appointmentPath(id)}/status`, "POST", { status, notify }, "change this booking");
}

export async function rescheduleAppointment(id: string, date: string, time: string, notify: boolean) {
  return send(`${appointmentPath(id)}/reschedule`, "POST", { date, time, notify }, "move this booking");
}

export async function saveAppointmentNotes(id: string, meetingLink: string, adminNote: string) {
  return send(appointmentPath(id), "PATCH", { meetingLink, adminNote }, "change this booking");
}

export type WindowValues = { weekday: number; startTime: string; endTime: string };
export type SettingsValues = {
  slotStepMinutes: number;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  maxPerDay: number | null;
  minNoticeHours: number;
  maxDaysAhead: number;
};

export async function saveWindows(windows: WindowValues[]) {
  return send("/api/admin/schedule/windows", "PUT", { windows }, "change the schedule");
}

export async function saveBookingSettings(settings: SettingsValues) {
  return send("/api/admin/schedule/settings", "PUT", settings, "change the booking rules");
}

export async function addBlockedDate(date: string, reason: string) {
  return send("/api/admin/schedule/blocked", "POST", { date, reason }, "block days");
}

export async function removeBlockedDate(date: string) {
  return send(`/api/admin/schedule/blocked/${encodeURIComponent(date)}`, "DELETE", undefined, "unblock days");
}
