"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ArticleCategory, ContentLocale } from "@/lib/articles";

export type ArticleFormValues = {
  slug: string;
  category: ArticleCategory;
  status: "draft" | "published";
  /** Cloudinary address of the cover photo, or "" for none */
  coverUrl: string;
  translations: Record<ContentLocale, { title: string; summary: string; body: string }>;
};

export type ArticleFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Creates the article (id null) or saves changes to it. */
export async function saveArticle(id: string | null, values: ArticleFormValues): Promise<ArticleFormResult> {
  const res = await adminFetch(id ? `/api/admin/articles/${encodeURIComponent(id)}` : "/api/admin/articles", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit articles." };
  if (!res.ok) {
    console.error("Saving article failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { article } = (await res.json()) as { article: { id: string } };
    redirect(`/admin/articles/${article.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteArticle(id: string) {
  const res = await adminFetch(`/api/admin/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Deleting article failed: ${res.status}`);
  redirect("/admin/articles");
}
