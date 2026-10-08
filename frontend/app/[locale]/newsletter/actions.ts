"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { caughtBySpamTrap } from "@/lib/spam-trap";

export type SignupState = { status: "idle" | "done" | "invalid" | "failed" };

async function post(path: string, body: unknown) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) throw new Error("API_URL is not set");
  return fetch(`${apiUrl}/api/newsletter/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      // Lets the API rate-limit per visitor rather than per website server
      "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
    },
    body: JSON.stringify(body),
  });
}

export async function subscribe(_prev: SignupState, formData: FormData): Promise<SignupState> {
  // A bot is told it worked, so it does not try again another way
  if (caughtBySpamTrap({ website: String(formData.get("website") ?? ""), startedAt: String(formData.get("startedAt") ?? "") })) {
    return { status: "done" };
  }
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { status: "invalid" };
  try {
    const res = await post("subscribe", { email: email.data, locale: await getLocale() });
    if (res.status === 400) return { status: "invalid" };
    if (!res.ok) {
      console.error("Newsletter API responded", res.status, await res.text());
      return { status: "failed" };
    }
  } catch (err) {
    console.error("Newsletter API unreachable", err);
    return { status: "failed" };
  }
  return { status: "done" };
}

/** Confirms from the link in the email. Null when the link is not valid. */
export async function confirmEmail(email: string, key: string) {
  const res = await post("confirm", { email, key });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Confirming responded ${res.status}`);
  return true;
}

export type LeaveState = { status: "idle" | "done" | "invalid" | "failed" };

export async function unsubscribe(email: string, key: string): Promise<LeaveState> {
  try {
    const res = await post("unsubscribe", { email, key });
    if (res.status === 404) return { status: "invalid" };
    return { status: res.ok ? "done" : "failed" };
  } catch (err) {
    console.error("Newsletter API unreachable", err);
    return { status: "failed" };
  }
}
