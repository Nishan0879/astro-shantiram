"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { caughtBySpamTrap } from "@/lib/spam-trap";

export type ReviewState = {
  status: "idle" | "success" | "error" | "failed";
  fieldErrors?: Record<string, string>;
  // What they typed, so a mistake does not wipe it
  values?: Record<string, string>;
};

const fields = ["name", "place", "email", "rating", "service", "message"] as const;

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const values = Object.fromEntries(fields.map((f) => [f, String(formData.get(f) ?? "").trim()]));
  // A bot is told it worked, so it does not try again another way
  if (caughtBySpamTrap({ website: String(formData.get("website") ?? ""), startedAt: String(formData.get("startedAt") ?? "") })) {
    return { status: "success" };
  }
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { status: "failed", values };
  try {
    const res = await fetch(`${apiUrl}/api/testimonials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
        "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
      },
      body: JSON.stringify({ ...values, rating: Number(values.rating) || 0, locale: await getLocale() }),
    });
    if (res.status === 400) {
      const body = (await res.json()) as { fieldErrors?: Record<string, string> };
      return { status: "error", fieldErrors: body.fieldErrors, values };
    }
    if (!res.ok) {
      console.error("Review API responded", res.status, await res.text());
      return { status: "failed", values };
    }
  } catch (err) {
    console.error("Review API unreachable", err);
    return { status: "failed", values };
  }
  return { status: "success" };
}
