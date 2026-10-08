"use server";

import type { Availability, CustomerBooking } from "@/lib/booking";
import { manageApi } from "@/lib/manage-api";

export type ManageResult = { ok: true; booking: CustomerBooking } | { ok: false; error: "taken" | "too_late" | "failed" };

const refPath = (reference: string) => encodeURIComponent(reference.toUpperCase());

/** The booking, or null when the link is wrong. */
export async function loadBooking(reference: string, key: string): Promise<CustomerBooking | null> {
  const res = await manageApi(`${refPath(reference)}?${new URLSearchParams({ key })}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Loading the booking failed: ${res.status}`);
  return ((await res.json()) as { booking: CustomerBooking }).booking;
}

export async function loadMoveTimes(reference: string, key: string, from?: string): Promise<Availability | null> {
  try {
    const res = await manageApi(`${refPath(reference)}/availability?${new URLSearchParams({ key, days: "35", ...(from ? { from } : {}) })}`);
    return res.ok ? ((await res.json()) as Availability) : null;
  } catch (err) {
    console.error("Loading open times failed", err);
    return null;
  }
}

async function change(reference: string, action: "cancel" | "move", body: object): Promise<ManageResult> {
  try {
    const res = await manageApi(`${refPath(reference)}/${action}`, { method: "POST", body: JSON.stringify(body) });
    if (res.ok) return { ok: true, booking: ((await res.json()) as { booking: CustomerBooking }).booking };
    const error = res.status === 409 ? ((await res.json()) as { error?: string }).error : undefined;
    if (error === "too_late") return { ok: false, error: "too_late" };
    if (error === "time_taken") return { ok: false, error: "taken" };
    console.error(`Booking ${action} responded`, res.status);
    return { ok: false, error: "failed" };
  } catch (err) {
    console.error(`Booking ${action} failed`, err);
    return { ok: false, error: "failed" };
  }
}

export async function cancelBooking(reference: string, key: string) {
  return change(reference, "cancel", { key });
}

export async function moveBooking(reference: string, key: string, date: string, time: string) {
  return change(reference, "move", { key, date, time });
}
