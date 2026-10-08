"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { FestivalKind } from "@/lib/festivals";

export type FestivalFormValues = {
  date: string;
  endDate: string;
  kind: FestivalKind;
  status: "draft" | "published";
  serviceSlug: string;
  translations: Record<ContentLocale, { name: string; description: string }>;
};

export type FestivalFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Adds the day (id null) or saves changes to it. */
export async function saveFestival(id: string | null, values: FestivalFormValues): Promise<FestivalFormResult> {
  const res = await adminFetch(id ? `/api/admin/festivals/${encodeURIComponent(id)}` : "/api/admin/festivals", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });
  if (res.status === 400) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit the calendar." };
  if (!res.ok) {
    console.error("Saving festival failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }
  if (!id) redirect(`/admin/festivals?year=${values.date.slice(0, 4)}&added=1`);
  refresh();
  return { ok: true };
}

export type BulkResult = { created?: number; error?: string; lines?: { line: number; text: string; message: string }[] };

/** Adds every line of a pasted list, all of one kind. */
export async function addFestivalList(kind: FestivalKind, locale: ContentLocale, text: string): Promise<BulkResult> {
  const res = await adminFetch("/api/admin/festivals/bulk", { method: "POST", body: JSON.stringify({ kind, locale, text }) });
  if (res.status === 400) {
    const body = (await res.json()) as { lines?: BulkResult["lines"]; fieldErrors?: Record<string, string> };
    if (body.lines?.length) return { error: "Nothing was added. Please fix these lines and try again:", lines: body.lines };
    return { error: body.fieldErrors?.text ?? "Please paste at least one line." };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit the calendar." };
  if (!res.ok) {
    console.error("Adding festival list failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }
  refresh();
  return { created: ((await res.json()) as { created: number }).created };
}

export async function deleteFestival(id: string, year: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/festivals/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting festival failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect(`/admin/festivals?year=${year}`);
}
