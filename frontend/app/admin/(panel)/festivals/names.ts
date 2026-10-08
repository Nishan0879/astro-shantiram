import type { FestivalKind } from "@/lib/festivals";

export const festivalKindNames: Record<FestivalKind, string> = {
  festival: "Festival",
  ekadashi: "Ekadashi",
  purnima: "Purnima (full moon)",
  amavasya: "Amavasya (new moon)",
  sankranti: "Sankranti",
  puja: "Special puja day",
  other: "Other",
};
