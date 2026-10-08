// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";

export const festivalKinds = ["festival", "ekadashi", "purnima", "amavasya", "sankranti", "puja", "other"] as const;
export type FestivalKind = (typeof festivalKinds)[number];

export type PublicFestival = {
  id: string;
  date: string;
  endDate: string | null;
  kind: FestivalKind;
  serviceSlug: string | null;
  locale: ContentLocale;
  name: string;
  description: string | null;
};

export type FestivalYear = {
  year: number;
  today: string;
  festivals: PublicFestival[];
  events: { slug: string; date: string; startTime: string | null; locale: ContentLocale; name: string }[];
};

/** Badge colours, so vrat days and festivals are easy to tell apart. */
export const kindClass: Record<FestivalKind | "event", string> = {
  festival: "bg-saffron/15 text-saffron-dark",
  ekadashi: "bg-green-100 text-green-900",
  purnima: "bg-amber-100 text-amber-900",
  amavasya: "bg-indigo-100 text-indigo-900",
  sankranti: "bg-orange-100 text-orange-900",
  puja: "bg-maroon/10 text-maroon",
  other: "bg-charcoal/10 text-charcoal/80",
  event: "bg-sky-100 text-sky-900",
};

/** Whole days from one Central date to another. */
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
