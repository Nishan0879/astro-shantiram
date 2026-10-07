import { z } from "zod";
import { contentLocales, type HoroscopePeriod, horoscopePeriods, zodiacSigns } from "../db/schema.js";

const text = (max: number) => z.string().trim().max(max).default("");

const readingSchema = z.object({
  overview: text(5000),
  career: text(3000),
  finance: text(3000),
  relationships: text(3000),
  health: text(3000),
  spiritual: text(3000),
  lucky: text(300),
});
type Reading = z.infer<typeof readingSchema>;

const readingFields = ["overview", "career", "finance", "relationships", "health", "spiritual", "lucky"] as const;
const isBlank = (r: Reading | undefined) => !r || readingFields.every((f) => !r[f]);

/** Periods that cover a calendar span; there is at most one edition per span. */
export const calendarPeriods = ["daily", "weekly", "monthly", "yearly"] as const satisfies HoroscopePeriod[];
export const isCalendarPeriod = (p: HoroscopePeriod) => (calendarPeriods as readonly string[]).includes(p);

/** Moves a date to the start of its span: the Sunday of its week, the 1st of its month, or January 1. */
export function periodStart(period: HoroscopePeriod, isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (period === "monthly") return `${isoDate.slice(0, 7)}-01`;
  if (period === "yearly") return `${isoDate.slice(0, 4)}-01-01`;
  if (period === "weekly") {
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.toISOString().slice(0, 10);
  }
  return isoDate;
}

/** Whether an edition starting on startsOn still covers today (both YYYY-MM-DD). */
export function coversToday(period: HoroscopePeriod, startsOn: string, today: string) {
  if (!isCalendarPeriod(period)) return false;
  return periodStart(period, today) === startsOn;
}

export const horoscopeInputSchema = z
  .object({
    period: z.enum(horoscopePeriods),
    startsOn: z.iso.date("Pick a date"),
    status: z.enum(["draft", "published"]),
    translations: z.partialRecord(z.enum(contentLocales), z.object({ title: text(200), intro: text(5000) })),
    readings: z.partialRecord(z.enum(zodiacSigns), z.partialRecord(z.enum(contentLocales), readingSchema)),
  })
  .superRefine((input, ctx) => {
    let readings = 0;
    for (const sign of zodiacSigns) {
      for (const locale of contentLocales) {
        const r = input.readings[sign]?.[locale];
        if (isBlank(r)) continue;
        readings++;
        if (!r?.overview) {
          ctx.addIssue({ code: "custom", path: ["readings", sign, locale, "overview"], message: "Add the overview" });
        }
      }
    }
    const translations = contentLocales.map((l) => input.translations[l]);
    if (isCalendarPeriod(input.period)) {
      if (readings === 0) ctx.addIssue({ code: "custom", path: ["readings"], message: "Write the reading for at least one sign" });
      return;
    }
    // Festival and special updates need a name, and may speak to all signs at once
    if (!translations.some((t) => t?.title)) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Give it a title, like “Maha Shivaratri 2027”" });
    } else if (readings === 0 && !translations.some((t) => t?.intro)) {
      ctx.addIssue({ code: "custom", path: ["readings"], message: "Write the message for all signs, or a reading for at least one sign" });
    }
  })
  .transform((input) => ({ ...input, startsOn: periodStart(input.period, input.startsOn) }));

export type HoroscopeInput = z.infer<typeof horoscopeInputSchema>;

const orNull = (v: string) => v || null;

export function horoscopeRows(editionId: string, input: HoroscopeInput) {
  const translations = contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.title && !t?.intro) return [];
    return [{ editionId, locale, title: orNull(t.title), intro: orNull(t.intro) }];
  });
  const readings = zodiacSigns.flatMap((sign) =>
    contentLocales.flatMap((locale) => {
      const r = input.readings[sign]?.[locale];
      if (!r?.overview) return [];
      return [
        {
          editionId,
          sign,
          locale,
          overview: r.overview,
          career: orNull(r.career),
          finance: orNull(r.finance),
          relationships: orNull(r.relationships),
          health: orNull(r.health),
          spiritual: orNull(r.spiritual),
          lucky: orNull(r.lucky),
        },
      ];
    }),
  );
  return { translations, readings };
}
