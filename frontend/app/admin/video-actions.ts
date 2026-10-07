"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { BookLanguage } from "@/lib/books";
import type { VideoCategory, VideoKind } from "@/lib/videos";

export type VideoFormValues = {
  youtubeUrl: string;
  kind: VideoKind;
  status: "draft" | "published";
  category: VideoCategory;
  language: BookLanguage;
  /** YYYY-MM-DD, or "" when unknown */
  publishedOn: string;
  featured: boolean;
  translations: Record<ContentLocale, { title: string; description: string }>;
};

export type VideoFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export type VideoLookup = { youtubeId: string; kind: VideoKind; title: string | null; channel: string | null; existingId: string | null };

/** What YouTube says about a pasted link, or null when it is not a YouTube video link. */
export async function lookupVideo(url: string): Promise<VideoLookup | null> {
  const res = await adminFetch(`/api/admin/videos/lookup?${new URLSearchParams({ url })}`);
  if (!res.ok) return null;
  return (await res.json()) as VideoLookup;
}

/** Creates the video (id null) or saves changes to it. */
export async function saveVideo(id: string | null, values: VideoFormValues): Promise<VideoFormResult> {
  const res = await adminFetch(id ? `/api/admin/videos/${encodeURIComponent(id)}` : "/api/admin/videos", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit videos." };
  if (!res.ok) {
    console.error("Saving video failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { video } = (await res.json()) as { video: { id: string } };
    redirect(`/admin/videos/${video.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteVideo(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this video." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting video failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/videos");
}
