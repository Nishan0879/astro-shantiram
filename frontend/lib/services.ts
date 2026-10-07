// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";

export const serviceCategories = ["astrology", "puja"] as const;
export type ServiceCategory = (typeof serviceCategories)[number];

// Messages: Services.modes.*
export const serviceModes = ["in_person", "home_visit", "phone", "zoom"] as const;
export type ServiceMode = (typeof serviceModes)[number];

export type ServiceSummary = {
  slug: string;
  category: ServiceCategory;
  /** US dollars in cents; null means "ask for the price" */
  priceCents: number | null;
  priceFrom: boolean;
  durationMinutes: number | null;
  modes: ServiceMode[];
  bookingOpen: boolean;
  imageUrl: string | null;
  locale: ContentLocale;
  name: string;
  summary: string | null;
};

export type PublicService = ServiceSummary & {
  description: string | null;
  purpose: string | null;
  requirements: string | null;
  location: string | null;
  availability: string | null;
  updatedAt: string;
};

/** "$151" or "$151.50", in the visitor's digits. */
export function formatPrice(cents: number, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Splits minutes into hours and minutes for the Services.duration message. */
export function durationParts(minutes: number) {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export const inquiryCategories = [
  "general",
  "puja",
  "astrology",
  "consultation",
  "events",
  "books",
  "other",
] as const;
