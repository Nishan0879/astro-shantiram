// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";

export const zodiacSigns = [
  "mesha",
  "vrishabha",
  "mithuna",
  "karka",
  "simha",
  "kanya",
  "tula",
  "vrishchika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;
export type ZodiacSign = (typeof zodiacSigns)[number];

export const calendarPeriods = ["daily", "weekly", "monthly", "yearly"] as const;
export type CalendarPeriod = (typeof calendarPeriods)[number];
export const horoscopePeriods = [...calendarPeriods, "festival", "special"] as const;
export type HoroscopePeriod = (typeof horoscopePeriods)[number];

export const readingFields = ["overview", "career", "finance", "relationships", "health", "spiritual", "lucky"] as const;
export type ReadingField = (typeof readingFields)[number];

/**
 * The glyph, Western name, and roughly when the Sun is in each sign in Vedic (sidereal) astrology.
 * The dates shift by a day from year to year. Each glyph ends in U+FE0E so phones draw it as text, not colour emoji.
 */
export const signInfo: Record<ZodiacSign, { glyph: string; western: string; from: string; to: string }> = {
  mesha: { glyph: "♈\uFE0E", western: "Aries", from: "04-14", to: "05-14" },
  vrishabha: { glyph: "♉\uFE0E", western: "Taurus", from: "05-15", to: "06-14" },
  mithuna: { glyph: "♊\uFE0E", western: "Gemini", from: "06-15", to: "07-16" },
  karka: { glyph: "♋\uFE0E", western: "Cancer", from: "07-17", to: "08-16" },
  simha: { glyph: "♌\uFE0E", western: "Leo", from: "08-17", to: "09-16" },
  kanya: { glyph: "♍\uFE0E", western: "Virgo", from: "09-17", to: "10-17" },
  tula: { glyph: "♎\uFE0E", western: "Libra", from: "10-18", to: "11-16" },
  vrishchika: { glyph: "♏\uFE0E", western: "Scorpio", from: "11-17", to: "12-15" },
  dhanu: { glyph: "♐\uFE0E", western: "Sagittarius", from: "12-16", to: "01-14" },
  makara: { glyph: "♑\uFE0E", western: "Capricorn", from: "01-15", to: "02-12" },
  kumbha: { glyph: "♒\uFE0E", western: "Aquarius", from: "02-13", to: "03-14" },
  meena: { glyph: "♓\uFE0E", western: "Pisces", from: "03-15", to: "04-13" },
};

export type Reading = { sign: ZodiacSign; locale: ContentLocale } & Record<Exclude<ReadingField, "overview">, string | null> & {
    overview: string;
  };

export type PublicEdition = {
  id: string;
  period: HoroscopePeriod;
  startsOn: string;
  /** Whether it is for today, this week, this month or this year */
  covers: boolean;
  title: string | null;
  intro: string | null;
  titleLocale: ContentLocale | null;
  readings: Reading[];
};

export type SpecialSummary = { id: string; period: "festival" | "special"; startsOn: string; title: string; titleLocale: ContentLocale };

/** The first day of the span a date falls in (weeks start on Sunday), as YYYY-MM-DD. */
export function periodStart(period: HoroscopePeriod, isoDate: string) {
  if (period === "monthly") return `${isoDate.slice(0, 7)}-01`;
  if (period === "yearly") return `${isoDate.slice(0, 4)}-01-01`;
  if (period === "weekly") {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.toISOString().slice(0, 10);
  }
  return isoDate;
}

/** A YYYY-MM-DD date as a Date at noon UTC, so formatting it never slips to the day before. */
export const calendarDate = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

export function addDays(isoDate: string, days: number) {
  const date = calendarDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Oct 4 – Oct 10, 2026", "October 2026", "2026" or a single day, in the given language. */
export function spanLabel(period: HoroscopePeriod, startsOn: string, locale: string) {
  const day = (iso: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
    calendarDate(iso).toLocaleDateString(locale, { ...options, timeZone: "UTC" });
  if (period === "weekly") return `${day(startsOn, { month: "short", day: "numeric" })} – ${day(addDays(startsOn, 6))}`;
  if (period === "monthly") return day(startsOn, { month: "long", year: "numeric" });
  if (period === "yearly") return day(startsOn, { year: "numeric" });
  return day(startsOn);
}
