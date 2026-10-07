import { z } from "zod";
import { articleCategories, contentLocales } from "../db/schema.js";

const translationSchema = z.object({
  title: z.string().trim().max(200).default(""),
  summary: z.string().trim().max(500).default(""),
  body: z.string().trim().max(100_000).default(""),
});

export const articleInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    category: z.enum(articleCategories),
    status: z.enum(["draft", "published"]),
    coverUrl: z
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
      if (!t || (!t.title && !t.body && !t.summary)) continue;
      filled++;
      if (!t.title) ctx.addIssue({ code: "custom", path: ["translations", locale, "title"], message: "Add a title" });
      if (!t.body) ctx.addIssue({ code: "custom", path: ["translations", locale, "body"], message: "Add the article text" });
    }
    if (filled === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Write the article in at least one language" });
    }
  });

export type ArticleInput = z.infer<typeof articleInputSchema>;

/** The translations that have content, as rows ready to insert. */
export function translationRows(articleId: string, input: ArticleInput) {
  return contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.title || !t.body) return [];
    return [{ articleId, locale, title: t.title, summary: t.summary || null, body: t.body }];
  });
}
