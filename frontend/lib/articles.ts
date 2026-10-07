// Shared by the admin and the public site, so it must stay free of server-only imports

export const articleCategories = [
  "astrology",
  "spiritual",
  "festivals",
  "sanskrit",
  "culture",
  "puja",
  "dharma",
  "guidance",
] as const;
export type ArticleCategory = (typeof articleCategories)[number];

export const contentLocales = ["en", "ne", "sa"] as const;
export type ContentLocale = (typeof contentLocales)[number];

export type ArticleSummary = {
  slug: string;
  category: ArticleCategory;
  publishedAt: string;
  locale: ContentLocale;
  title: string;
  summary: string | null;
};

export type PublicArticle = ArticleSummary & { body: string; updatedAt: string; locales: ContentLocale[] };

export type ArticleList = { articles: ArticleSummary[]; total: number; page: number; pageSize: number };

/** Turns a title into an address like "meaning-of-maha-shivaratri". */
export function slugify(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}
