"use server";

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
  status: "idle" | "success" | "error";
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

  // TODO: send via the backend API (/api/contact) once it exists, which stores
  // the message and emails it. Until then it is only logged on the server.
  console.info("Contact message received", parsed.data);
  return { status: "success" };
}
