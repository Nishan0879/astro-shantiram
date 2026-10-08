import { z } from "zod";
import { contentLocales, festivalKinds } from "../db/schema.js";

const translationSchema = z.object({
  name: z.string().trim().max(200).default(""),
  description: z.string().trim().max(20_000).default(""),
});

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick the date")
  .transform((v) => v || null);

export const festivalInputSchema = z
  .object({
    date: z.iso.date("Pick the date"),
    // prefault, not default, so a missing end date still becomes null
    endDate: optionalDate.prefault(""),
    kind: z.enum(festivalKinds, { error: "Choose what kind of day it is" }),
    status: z.enum(["draft", "published"]).default("published"),
    serviceSlug: z
      .string()
      .trim()
      .max(120)
      .default("")
      .transform((v) => v || null),
    translations: z.partialRecord(z.enum(contentLocales), translationSchema),
  })
  .superRefine((input, ctx) => {
    let filled = 0;
    for (const locale of contentLocales) {
      const t = input.translations[locale];
      if (!t || (!t.name && !t.description)) continue;
      filled++;
      if (!t.name) ctx.addIssue({ code: "custom", path: ["translations", locale, "name"], message: "Add the name" });
    }
    if (filled === 0) ctx.addIssue({ code: "custom", path: ["translations"], message: "Name the day in at least one language" });
    if (input.endDate && input.endDate <= input.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The last day must be after the first day" });
    }
  });

export type FestivalInput = z.infer<typeof festivalInputSchema>;

export function festivalTranslationRows(festivalId: string, input: FestivalInput) {
  return contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.name) return [];
    return [{ festivalId, locale, name: t.name, description: t.description || null }];
  });
}

export const bulkInputSchema = z.object({
  kind: z.enum(festivalKinds, { error: "Choose what kind of days these are" }),
  locale: z.enum(contentLocales).default("en"),
  text: z.string().max(20_000),
});

const isRealDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

/** "11/1/2026" or "2026-11-01" → "2026-11-01", or null when it is not a real date. */
function readDate(text: string) {
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && isRealDate(iso) ? iso : null;
}

/**
 * Reads a pasted list, one day per line: a date, then the name.
 * "2026-11-01 Haribodhini Ekadashi" or "11/1/2026 Haribodhini Ekadashi". Blank lines are skipped.
 */
export function parseFestivalList(text: string) {
  const days: { date: string; name: string }[] = [];
  const errors: { line: number; text: string; message: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [first, ...rest] = line.split(/\s+/);
    const date = readDate(first.replace(/[,;:]$/, ""));
    const name = rest.join(" ").replace(/^[-–:,|]\s*/, "").trim();
    if (!date) errors.push({ line: i + 1, text: line, message: "Start the line with a date like 2026-11-01 or 11/1/2026" });
    else if (!name) errors.push({ line: i + 1, text: line, message: "Add the name after the date" });
    else if (name.length > 200) errors.push({ line: i + 1, text: line, message: "The name is too long" });
    else days.push({ date, name });
  });
  if (days.length + errors.length > 400) errors.push({ line: 0, text: "", message: "Paste at most 400 lines at a time" });
  return { days, errors };
}
