import { calendarPeriods, type CalendarPeriod, type PublicEdition, type SpecialSummary } from "@/lib/horoscopes";
import { publicJson } from "@/lib/public-api";

export const pickPeriod = (value: unknown): CalendarPeriod => calendarPeriods.find((p) => p === value) ?? "daily";

export async function currentEdition(period: CalendarPeriod, locale: string) {
  return (await publicJson<{ edition: PublicEdition | null }>(`/api/horoscopes/current?period=${period}&locale=${locale}`))?.edition ?? null;
}

export async function specialEditions(locale: string) {
  return (await publicJson<{ specials: SpecialSummary[] }>(`/api/horoscopes/specials?locale=${locale}`))?.specials ?? [];
}

export async function edition(id: string, locale: string) {
  return (await publicJson<{ edition: PublicEdition }>(`/api/horoscopes/${encodeURIComponent(id)}?locale=${locale}`))?.edition ?? null;
}
