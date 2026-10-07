import type { HoroscopeFormValues, ReadingValues } from "@/app/admin/horoscope-actions";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { zodiacSigns } from "@/lib/horoscopes";

const emptyReading: ReadingValues = { overview: "", career: "", finance: "", relationships: "", health: "", spiritual: "", lucky: "" };

/** A blank daily horoscope for the given date (YYYY-MM-DD). */
export function emptyHoroscope(startsOn: string): HoroscopeFormValues {
  const perLocale = () => Object.fromEntries(contentLocales.map((l) => [l, { ...emptyReading }])) as Record<ContentLocale, ReadingValues>;
  return {
    period: "daily",
    startsOn,
    status: "draft",
    translations: { en: { title: "", intro: "" }, ne: { title: "", intro: "" }, sa: { title: "", intro: "" } },
    readings: Object.fromEntries(zodiacSigns.map((s) => [s, perLocale()])) as HoroscopeFormValues["readings"],
  };
}
