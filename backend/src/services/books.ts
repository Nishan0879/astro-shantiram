import { z } from "zod";
import { bookCategories, bookLanguages, contentLocales } from "../db/schema.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v || null);

const translationSchema = z.object({
  title: z.string().trim().max(200).default(""),
  author: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
});

export const bookInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    status: z.enum(["draft", "published"]),
    category: z.enum(bookCategories),
    language: z.enum(bookLanguages),
    publishedOn: z
      .union([z.iso.date(), z.literal("")])
      .default("")
      .transform((v) => v || null),
    featured: z.boolean().default(false),
    pdfUrl: z.string().trim().max(500).min(1, "Upload the PDF"),
    pdfPublicId: optionalText(300),
    pageCount: z.number().int().positive().nullable().default(null),
    coverUrl: optionalText(500),
    translations: z.partialRecord(z.enum(contentLocales), translationSchema),
  })
  .superRefine((input, ctx) => {
    let filled = 0;
    for (const locale of contentLocales) {
      const t = input.translations[locale];
      if (!t || (!t.title && !t.author && !t.description)) continue;
      filled++;
      if (!t.title) ctx.addIssue({ code: "custom", path: ["translations", locale, "title"], message: "Add a title" });
    }
    if (filled === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Add the title in at least one language" });
    }
  });

export type BookInput = z.infer<typeof bookInputSchema>;

/** The translations that have a title, as rows ready to insert. */
export function bookTranslationRows(bookId: string, input: BookInput) {
  return contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.title) return [];
    return [{ bookId, locale, title: t.title, author: t.author || null, description: t.description || null }];
  });
}
