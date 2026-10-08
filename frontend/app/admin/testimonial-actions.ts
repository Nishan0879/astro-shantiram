"use server";

import { refresh } from "next/cache";
import { adminFetch } from "@/lib/admin-api";
import { type TestimonialStatus, testimonialStatuses } from "@/lib/testimonials";

async function update(id: string, changes: Record<string, unknown>) {
  const res = await adminFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) });
  if (!res.ok) throw new Error(`Updating review failed: ${res.status}`);
  refresh();
}

export async function setTestimonialStatus(id: string, status: TestimonialStatus) {
  if (!testimonialStatuses.includes(status)) return;
  await update(id, { status });
}

export async function setTestimonialFeatured(id: string, featured: boolean) {
  await update(id, { featured });
}

/** Light corrections, such as a typo or a surname the client asked to leave out. */
export async function editTestimonial(id: string, formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  await update(id, { name: text("name"), place: text("place"), service: text("service"), message: text("message") });
}

export async function deleteTestimonial(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 403) return { error: "Your account is not allowed to delete reviews." };
  if (!res.ok) return { error: "Something went wrong. Please try again." };
  refresh();
}
