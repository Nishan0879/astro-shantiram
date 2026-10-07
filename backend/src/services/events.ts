import { z } from "zod";
import { contentLocales } from "../db/schema.js";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Paste a full link starting with https://")
  .transform((v) => v || null);

const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v), "Use a time like 18:30")
  .transform((v) => v || null);

const translationSchema = z.object({
  name: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  description: z.string().trim().max(20_000).default(""),
});

export const eventInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    status: z.enum(["draft", "published"]),
    eventDate: z.iso.date("Pick the date"),
    startTime: optionalTime.default(""),
    endTime: optionalTime.default(""),
    registrationUrl: optionalUrl.default(""),
    youtubeUrl: optionalUrl.default(""),
    zoomUrl: optionalUrl.default(""),
    translations: z.partialRecord(z.enum(contentLocales), translationSchema),
  })
  .superRefine((input, ctx) => {
    let filled = 0;
    for (const locale of contentLocales) {
      const t = input.translations[locale];
      if (!t || (!t.name && !t.location && !t.description)) continue;
      filled++;
      if (!t.name) ctx.addIssue({ code: "custom", path: ["translations", locale, "name"], message: "Add the event name" });
    }
    if (filled === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Name the event in at least one language" });
    }
    if (input.startTime && input.endTime && input.endTime <= input.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "The end time must be after the start time" });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export function eventTranslationRows(eventId: string, input: EventInput) {
  return contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.name) return [];
    return [{ eventId, locale, name: t.name, location: t.location || null, description: t.description || null }];
  });
}

/** The astrologer and visitors are in the US; event dates and times are US Eastern. */
export const SITE_TIME_ZONE = "America/New_York";

/** Today's date in US Eastern time as YYYY-MM-DD, which decides upcoming vs past. */
export function todayLocal(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE }).format(now);
}
