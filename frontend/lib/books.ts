// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";
import { cloudinaryImage } from "./media";

export const bookCategories = ["astrology", "spirituality", "dharma", "sanskrit", "culture", "puja", "philosophy", "other"] as const;
export type BookCategory = (typeof bookCategories)[number];

export const bookLanguages = ["en", "ne", "sa", "hi", "other"] as const;
export type BookLanguage = (typeof bookLanguages)[number];

export type BookSummary = {
  slug: string;
  category: BookCategory;
  language: BookLanguage;
  featured: boolean;
  pdfUrl: string;
  coverUrl: string | null;
  locale: ContentLocale;
  title: string;
  author: string | null;
};

export type PublicBook = BookSummary & {
  publishedOn: string | null;
  pageCount: number | null;
  description: string | null;
};

export type BookList = { books: BookSummary[]; total: number; page: number; pageSize: number };

/** The cover photo, or else the PDF's first page rendered as an image by Cloudinary. */
export function bookCover(book: { coverUrl: string | null; pdfUrl: string }, transform: string) {
  if (book.coverUrl) return cloudinaryImage(book.coverUrl, transform);
  return cloudinaryImage(book.pdfUrl.replace(/\.pdf$/i, ".jpg"), `pg_1,${transform}`);
}

/** A link that makes the browser save the PDF instead of opening it. */
export function pdfDownloadUrl(pdfUrl: string) {
  return pdfUrl.replace("/image/upload/", "/image/upload/fl_attachment/");
}
