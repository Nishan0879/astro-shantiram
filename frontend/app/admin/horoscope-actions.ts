"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { HoroscopePeriod, ReadingField, ZodiacSign } from "@/lib/horoscopes";

export type ReadingValues = Record<ReadingField, string>;

export type HoroscopeFormValues = {
  period: HoroscopePeriod;
  /** YYYY-MM-DD */
  startsOn: string;
  status: "draft" | "published";
  translations: Record<ContentLocale, { title: string; intro: string }>;
  readings: Record<ZodiacSign, Record<ContentLocale, ReadingValues>>;
};

export type HoroscopeFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; existingId?: string };

/** Creates the horoscope (id null) or saves changes to it. */
export async function saveHoroscope(id: string | null, values: HoroscopeFormValues): Promise<HoroscopeFormResult> {
  const res = await adminFetch(id ? `/api/admin/horoscopes/${encodeURIComponent(id)}` : "/api/admin/horoscopes", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string>; existingId?: string };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors, existingId: body.existingId };
  }
  if (res.status === 403) return { error: "Your account is not allowed to write horoscopes." };
  if (!res.ok) {
    console.error("Saving horoscope failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { edition } = (await res.json()) as { edition: { id: string } };
    redirect(`/admin/horoscopes/${edition.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteHoroscope(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/horoscopes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this horoscope." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting horoscope failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/horoscopes");
}
