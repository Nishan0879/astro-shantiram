"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import type { SendProgress } from "@/lib/newsletter";

export type IssueResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; notice?: string };

/** Saves a draft; a new one goes to its own page so it can be tested and sent. */
export async function saveIssue(id: string | null, values: { subject: string; body: string }): Promise<IssueResult> {
  const res = await adminFetch(id ? `/api/admin/newsletter/issues/${encodeURIComponent(id)}` : "/api/admin/newsletter/issues", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(values),
  });
  if (res.status === 400) {
    const body = (await res.json()) as { fieldErrors?: Record<string, string> };
    return { error: "Please fill in the highlighted fields.", fieldErrors: body.fieldErrors };
  }
  if (res.status === 409) return { error: "This update has already been sent, so it can no longer be changed." };
  if (!res.ok) return { error: "Something went wrong. Please try again." };
  if (!id) redirect(`/admin/newsletter/${((await res.json()) as { issue: { id: string } }).issue.id}?saved=1`);
  refresh();
  return { ok: true, notice: "Saved." };
}

export async function sendTest(id: string): Promise<IssueResult> {
  const res = await adminFetch(`/api/admin/newsletter/issues/${encodeURIComponent(id)}/test`, { method: "POST" });
  if (res.status === 503) return { error: "Email is not set up yet, so nothing can be sent. See Account → Send a test email." };
  if (!res.ok) return { error: "The test email could not be sent. Please try again." };
  const { sentTo } = (await res.json()) as { sentTo: string };
  return { ok: true, notice: `A test copy was sent to ${sentTo}.` };
}

/** Starts sending, or sends the next few. The page calls it until nothing is left. */
export async function sendNext(id: string): Promise<SendProgress | { error: string }> {
  const res = await adminFetch(`/api/admin/newsletter/issues/${encodeURIComponent(id)}/send`, { method: "POST" });
  if (res.status === 503) return { error: "Email is not set up yet, so nothing can be sent." };
  if (!res.ok) return { error: "Sending stopped because of an error. Press Continue sending to try again." };
  return (await res.json()) as SendProgress;
}

export async function deleteIssue(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/newsletter/issues/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 409) return { error: "A sent update cannot be deleted." };
  if (!res.ok) return { error: "Something went wrong. Please try again." };
  redirect("/admin/newsletter");
}

export async function deleteSubscriber(id: string): Promise<{ error: string } | void> {
  const res = await adminFetch(`/api/admin/newsletter/subscribers/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return { error: "Something went wrong. Please try again." };
  refresh();
}
