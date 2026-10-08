"use server";

import { adminFetch } from "@/lib/admin-api";

export type TestEmailResult = { ok?: boolean; sentTo?: string; error?: string };

export async function sendTestEmail(): Promise<TestEmailResult> {
  const res = await adminFetch("/api/admin/email/test", { method: "POST" });
  if (res.status === 503) return { error: "Email is not set up yet. Add the SMTP settings in Vercel first." };
  if (res.status === 403) return { error: "Only the main admin can send a test email." };
  if (res.status === 502) {
    const json = (await res.json()) as { detail?: string };
    return { error: `The email could not be sent. The mail server said: ${json.detail ?? "no details"}` };
  }
  if (!res.ok) {
    console.error("Failed to send test email", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }
  const json = (await res.json()) as { sentTo: string };
  return { ok: true, sentTo: json.sentTo };
}

export type ZoomCheckResult = { ok?: boolean; error?: string };

export async function checkZoomLogin(): Promise<ZoomCheckResult> {
  const res = await adminFetch("/api/admin/zoom/test", { method: "POST" });
  if (res.status === 503) return { error: "Zoom is not set up yet. Add the Zoom settings in Vercel first." };
  if (res.status === 403) return { error: "Only the main admin can check Zoom." };
  if (res.status === 502) {
    const json = (await res.json()) as { detail?: string };
    return { error: json.detail ?? "Zoom refused the login." };
  }
  if (!res.ok) {
    console.error("Failed to check Zoom", res.status, await res.text());
    return { error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
