import type { ServiceFormValues, ServiceWriting } from "@/app/admin/service-actions";

const noWriting: ServiceWriting = { name: "", summary: "", description: "", purpose: "", requirements: "", location: "", availability: "" };

export const emptyService: ServiceFormValues = {
  slug: "",
  status: "draft",
  category: "puja",
  sortOrder: 0,
  price: "",
  priceFrom: false,
  durationMinutes: null,
  modes: [],
  bookingOpen: true,
  imageUrl: "",
  translations: { en: noWriting, ne: noWriting, sa: noWriting },
};

/** Cents from the database as the dollars the form shows: 15100 → "151", 15150 → "151.50". */
export function centsToDollars(cents: number | null) {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
