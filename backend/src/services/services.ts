import { z } from "zod";
import { contentLocales, serviceCategories, serviceModes } from "../db/schema.js";

const translationSchema = z.object({
  name: z.string().trim().max(200).default(""),
  summary: z.string().trim().max(300).default(""),
  description: z.string().trim().max(10000).default(""),
  purpose: z.string().trim().max(5000).default(""),
  requirements: z.string().trim().max(5000).default(""),
  location: z.string().trim().max(300).default(""),
  availability: z.string().trim().max(300).default(""),
});

type TranslationInput = z.infer<typeof translationSchema>;
const writingFields = ["name", "summary", "description", "purpose", "requirements", "location", "availability"] as const;

/** "51", "$51.00" or "1,001" to cents; empty means no price is shown. */
const dollars = z
  .string()
  .trim()
  .max(20)
  .default("")
  .refine((v) => v === "" || /^\$?\s*\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(v), "Type the price in dollars, like 51 or 151.00")
  .transform((v) => (v === "" ? null : Math.round(Number(v.replace(/[$,\s]/g, "")) * 100)))
  .refine((cents) => cents === null || cents <= 10_000_000, "That price looks too high");

export const serviceInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    status: z.enum(["draft", "published"]),
    category: z.enum(serviceCategories),
    sortOrder: z.number().int().min(0).max(100_000).default(0),
    price: dollars,
    priceFrom: z.boolean().default(false),
    durationMinutes: z
      .number({ error: "Type the length in minutes" })
      .int("Type whole minutes")
      .min(5, "At least 5 minutes")
      .max(60 * 24 * 7, "That is longer than a week")
      .nullable()
      .default(null),
    modes: z.array(z.enum(serviceModes)).max(serviceModes.length).default([]),
    bookingOpen: z.boolean().default(true),
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .default("")
      .transform((v) => v || null),
    translations: z.partialRecord(z.enum(contentLocales), translationSchema),
  })
  .superRefine((input, ctx) => {
    let filled = 0;
    for (const locale of contentLocales) {
      const t = input.translations[locale];
      if (!t || writingFields.every((f) => !t[f])) continue;
      filled++;
      if (!t.name) ctx.addIssue({ code: "custom", path: ["translations", locale, "name"], message: "Add the name" });
    }
    if (filled === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Add the name in at least one language" });
    }
    if (input.priceFrom && input.price === null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Add the starting price, or untick “Starting price”" });
    }
  })
  // Each way of offering it once, in a steady order
  .transform((input) => ({ ...input, modes: serviceModes.filter((m) => input.modes.includes(m)) }));

export type ServiceInput = z.infer<typeof serviceInputSchema>;

/** The translations that have a name, as rows ready to insert. */
export function serviceTranslationRows(serviceId: string, input: ServiceInput) {
  return contentLocales.flatMap((locale) => {
    const t: TranslationInput | undefined = input.translations[locale];
    if (!t?.name) return [];
    return [
      {
        serviceId,
        locale,
        name: t.name,
        summary: t.summary || null,
        description: t.description || null,
        purpose: t.purpose || null,
        requirements: t.requirements || null,
        location: t.location || null,
        availability: t.availability || null,
      },
    ];
  });
}
