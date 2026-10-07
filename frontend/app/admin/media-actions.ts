"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { GalleryCategory } from "@/lib/media";

export type UploadSignature = { uploadUrl: string; apiKey: string; timestamp: number; folder: string; signature: string };

/** Permission for the browser to upload one photo straight to Cloudinary. */
export async function signUpload(folder: "gallery" | "articles"): Promise<UploadSignature | { error: string }> {
  const res = await adminFetch("/api/admin/uploads/sign", { method: "POST", body: JSON.stringify({ folder }) });
  if (res.status === 503) return { error: "Photo uploads are not set up yet (CLOUDINARY_URL is missing on the API)." };
  if (!res.ok) return { error: "Could not start the upload. Please try again." };
  return res.json();
}

export type Captions = Partial<Record<ContentLocale, string>>;
export type NewGalleryItem =
  | { kind: "photo"; url: string; publicId: string; width: number; height: number; category: GalleryCategory; captions?: Captions }
  | { kind: "video"; url: string; category: GalleryCategory; captions?: Captions };

export type GalleryResult = { ok?: boolean; error?: string };

async function errorFrom(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { fieldErrors?: Record<string, string> };
  return Object.values(body.fieldErrors ?? {})[0] ?? "Something went wrong. Please try again.";
}

export async function addGalleryItem(item: NewGalleryItem): Promise<GalleryResult> {
  const res = await adminFetch("/api/admin/gallery", { method: "POST", body: JSON.stringify(item) });
  if (!res.ok) return { error: await errorFrom(res) };
  refresh();
  return { ok: true };
}

export async function updateGalleryItem(id: string, category: GalleryCategory, captions: Captions): Promise<GalleryResult> {
  const res = await adminFetch(`/api/admin/gallery/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ category, captions }),
  });
  if (!res.ok) return { error: await errorFrom(res) };
  refresh();
  return { ok: true };
}

export async function deleteGalleryItem(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this gallery item." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting gallery item failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/gallery");
}
