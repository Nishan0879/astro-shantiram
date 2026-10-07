import type { BookCategory, BookLanguage } from "@/lib/books";

export const bookCategoryNames: Record<BookCategory, string> = {
  astrology: "Astrology",
  spirituality: "Spirituality",
  dharma: "Sanatan Dharma",
  sanskrit: "Sanskrit",
  culture: "Nepali culture",
  puja: "Puja",
  philosophy: "Philosophy",
  other: "Other",
};

export const bookLanguageNames: Record<BookLanguage, string> = {
  en: "English",
  ne: "Nepali",
  sa: "Sanskrit",
  hi: "Hindi",
  other: "Other",
};
