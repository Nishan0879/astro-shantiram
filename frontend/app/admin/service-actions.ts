"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { ContentLocale } from "@/lib/articles";
import type { ServiceCategory, ServiceMode } from "@/lib/services";

export type ServiceWriting = {
  name: string;
  summary: string;
  description: string;
  purpose: string;
  requirements: string;
  location: string;
  availability: string;
};

export type ServiceFormValues = {
  slug: string;
  status: "draft" | "published";
  category: ServiceCategory;
  sortOrder: number;
  /** Dollars as typed, like "151" or "151.50"; "" shows "Ask for the price" */
  price: string;
  priceFrom: boolean;
  durationMinutes: number | null;
  modes: ServiceMode[];
  bookingOpen: boolean;
  imageUrl: string;
  translations: Record<ContentLocale, ServiceWriting>;
};

export type ServiceFormResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Creates the service (id null) or saves changes to it. */
export async function saveService(id: string | null, values: ServiceFormValues): Promise<ServiceFormResult> {
  const res = await adminFetch(id ? `/api/admin/services/${encodeURIComponent(id)}` : "/api/admin/services", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });

  if (res.status === 400 || res.status === 409) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fix the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 403) return { error: "Your account is not allowed to edit services." };
  if (!res.ok) {
    console.error("Saving service failed", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }

  if (!id) {
    const { service } = (await res.json()) as { service: { id: string } };
    redirect(`/admin/services/${service.id}?created=1`);
  }
  refresh();
  return { ok: true };
}

export async function deleteService(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/services/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete this service." };
  if (!res.ok && res.status !== 404) {
    console.error("Deleting service failed", res.status, await res.text());
    return { error: "Deleting failed. Please try again." };
  }
  redirect("/admin/services");
}
