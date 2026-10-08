import type { ServiceCategory, ServiceMode } from "@/lib/services";

export const serviceCategoryNames: Record<ServiceCategory, string> = { astrology: "Astrology", puja: "Puja" };

export const serviceModeNames: Record<ServiceMode, string> = {
  in_person: "In person",
  home_visit: "At the family's home",
  phone: "By phone",
  zoom: "On Zoom",
};
