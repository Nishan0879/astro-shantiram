import type { HoroscopePeriod, ReadingField, ZodiacSign } from "@/lib/horoscopes";

export const periodNames: Record<HoroscopePeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  festival: "Festival",
  special: "Special update",
};

export const signNames: Record<ZodiacSign, string> = {
  mesha: "Mesha",
  vrishabha: "Vrishabha",
  mithuna: "Mithuna",
  karka: "Karka",
  simha: "Simha",
  kanya: "Kanya",
  tula: "Tula",
  vrishchika: "Vrishchika",
  dhanu: "Dhanu",
  makara: "Makara",
  kumbha: "Kumbha",
  meena: "Meena",
};

export const fieldNames: Record<ReadingField, { label: string; hint?: string }> = {
  overview: { label: "Overview" },
  career: { label: "Career (optional)" },
  finance: { label: "Money (optional)" },
  relationships: { label: "Relationships (optional)" },
  health: { label: "Health and well-being (optional)" },
  spiritual: { label: "Spiritual guidance (optional)" },
  lucky: { label: "Lucky (optional)", hint: "For example: Red · 9 · Tuesday" },
};
