"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { BookCategory, BookLanguage } from "@/lib/books";

export type BookFormValues = {
  slug: string;
  status: "draft" | "published";
  category: BookCategory;
  language: BookLanguage;
  /** YYYY-MM-DD, or "" when unknown */
  publishedOn: string;
  featured: boolean;
  pdfUrl: string;
  pdfPublicId: string;
  pageCount: number | null;
  coverUrl: string;
  translations: Record<ContentLocale, { title: string; author: string; description: string }>;
};

export type BookFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Creates the book (id null) or saves changes to it. */
export async function saveBook(id: string | null, values: BookFormValues): Promise<BookFormResult> {
  const res = await adminFetch(id ? `/api/admin/books/${encodeURIComponent(id)}` : "/api/admin/books", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit books." };
  if (!res.ok) {
    console.error("Saving book failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { book } = (await res.json()) as { book: { id: string } };
    redirect(`/admin/books/${book.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteBook(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/books/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this book." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting book failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/books");
}
