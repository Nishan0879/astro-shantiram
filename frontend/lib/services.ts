// Service keys map to Services.astrology.* and Services.puja.* in messages/*.json.
// These move to the database once the backend and admin dashboard exist.
export const astrologyServices = [
  "kundali",
  "kundaliAnalysis",
  "compatibility",
  "career",
  "financial",
  "dasha",
  "navagraha",
  "vastu",
  "muhurat",
  "prashna",
  "name",
  "numerology",
] as const;

export const pujaServices = [
  "rudrabhishek",
  "satyanarayan",
  "navagrahaPuja",
  "grahaShanti",
  "lakshmi",
  "grihaPravesh",
  "havan",
  "marriage",
  "bratabandha",
  "shraddha",
  "custom",
] as const;

export const inquiryCategories = [
  "general",
  "puja",
  "astrology",
  "consultation",
  "events",
  "books",
  "other",
] as const;
