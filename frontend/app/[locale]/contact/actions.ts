"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { inquiryCategories } from "@/lib/services";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  phone: z.string().trim().max(40).optional(),
  category: z.enum(inquiryCategories),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export type ContactState = {
  status: "idle" | "success" | "error" | "failed";
  fieldErrors?: Partial<Record<keyof z.infer<typeof contactSchema>, string[]>>;
};

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    // No backend configured (e.g. local frontend-only work): log instead of saving
    console.warn("API_URL is not set; contact message not saved", parsed.data);
    return { status: "success" };
  }

  try {
    const res = await fetch(`${apiUrl}/api/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets the API rate-limit per visitor rather than per website server
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
        "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
      },
      body: JSON.stringify({ ...parsed.data, locale: await getLocale() }),
    });
    if (!res.ok) {
      console.error("Contact API responded", res.status, await res.text());
      return { status: "failed" };
    }
  } catch (err) {
    console.error("Contact API unreachable", err);
    return { status: "failed" };
  }
  return { status: "success" };
}
