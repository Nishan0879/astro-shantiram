"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";

export type EventFormValues = {
  slug: string;
  status: "draft" | "published";
  eventDate: string;
  startTime: string;
  endTime: string;
  registrationUrl: string;
  youtubeUrl: string;
  zoomUrl: string;
  translations: Record<ContentLocale, { name: string; location: string; description: string }>;
};

export type EventFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Creates the event (id null) or saves changes to it. */
export async function saveEvent(id: string | null, values: EventFormValues): Promise<EventFormResult> {
  const res = await adminFetch(id ? `/api/admin/events/${encodeURIComponent(id)}` : "/api/admin/events", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit events." };
  if (!res.ok) {
    console.error("Saving event failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { event } = (await res.json()) as { event: { id: string } };
    redirect(`/admin/events/${event.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this event." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting event failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/events");
}
