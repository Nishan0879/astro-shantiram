"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import type { AppointmentLanguage, Availability } from "@/lib/booking";
import { publicJson } from "@/lib/public-api";
import type { ServiceMode } from "@/lib/services";
import { caughtBySpamTrap, type SpamTrapValues } from "@/lib/spam-trap";

export type BookingValues = {
  service: string;
  date: string;
  time: string;
  mode: ServiceMode | "";
  language: AppointmentLanguage;
  name: string;
  email: string;
  phone: string;
  address: string;
  gotra: string;
  familyNames: string;
  notes: string;
};

export type BookingResult =
  | { ok: true; reference: string; date: string; time: string; manageKey: string | null }
  | { ok: false; error: "fix" | "taken" | "closed" | "failed"; fieldErrors?: Record<string, string> };

/** Open days and times for five weeks, from `from` or the first day that can be booked. */
export async function loadAvailability(service: string, from?: string): Promise<Availability | null> {
  const query = new URLSearchParams({ service, days: "35", ...(from ? { from } : {}) });
  try {
    return await publicJson<Availability>(`/api/booking/availability?${query}`);
  } catch (err) {
    console.error("Loading open times failed", err);
    return null;
  }
}

export async function requestBooking(values: BookingValues, trap: SpamTrapValues): Promise<BookingResult> {
  if (caughtBySpamTrap(trap)) return { ok: false, error: "failed" };
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "failed" };
  try {
    const res = await fetch(`${apiUrl}/api/booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets the API rate-limit per visitor rather than per website server
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
        "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
      },
      body: JSON.stringify({ ...values, locale: await getLocale() }),
    });
    if (res.status === 400) {
      const body = (await res.json()) as { fieldErrors?: Record<string, string> };
      return { ok: false, error: "fix", fieldErrors: body.fieldErrors };
    }
    if (res.status === 409) {
      const body = (await res.json()) as { error?: string };
      return { ok: false, error: body.error === "service_unavailable" ? "closed" : "taken" };
    }
    if (!res.ok) {
      console.error("Booking API responded", res.status, await res.text());
      return { ok: false, error: "failed" };
    }
    return { ok: true, ...((await res.json()) as { reference: string; date: string; time: string; manageKey: string | null }) };
  } catch (err) {
    console.error("Booking API unreachable", err);
    return { ok: false, error: "failed" };
  }
}
