// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";

export type SearchResults = {
  q: string;
  results: {
    articles: { slug: string; title: string; summary: string | null; locale: ContentLocale }[];
    books: { slug: string; title: string; author: string | null; locale: ContentLocale }[];
    videos: { youtubeId: string; title: string; kind: string; locale: ContentLocale }[];
    services: { slug: string; name: string; summary: string | null; locale: ContentLocale }[];
    events: { slug: string; name: string; date: string; location: string | null; locale: ContentLocale }[];
  };
};
