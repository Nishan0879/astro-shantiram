// Shared by the admin and the public site, so it must stay free of server-only imports
import type { ContentLocale } from "./articles";
import type { BookLanguage } from "./books";

export const videoCategories = [
  "gita",
  "vedas",
  "upanishads",
  "puranas",
  "dharma",
  "spirituality",
  "culture",
  "festivals",
  "astrology",
  "puja",
  "other",
] as const;
export type VideoCategory = (typeof videoCategories)[number];

export const videoKinds = ["video", "short", "live"] as const;
export type VideoKind = (typeof videoKinds)[number];

export type VideoSummary = {
  youtubeId: string;
  kind: VideoKind;
  category: VideoCategory;
  language: BookLanguage;
  publishedOn: string | null;
  featured: boolean;
  locale: ContentLocale;
  title: string;
};

export type PublicVideo = VideoSummary & { description: string | null; createdAt: string };

export type VideoList = { videos: VideoSummary[]; total: number; page: number; pageSize: number };

/** YouTube's own thumbnail; "hq" exists for every video, "maxres" only for HD uploads. */
export const videoThumbnail = (youtubeId: string, size: "mq" | "hq" = "hq") =>
  `https://i.ytimg.com/vi/${youtubeId}/${size}default.jpg`;

/** The privacy-friendly player: YouTube sets no cookies until the visitor presses play. */
export const videoEmbed = (youtubeId: string) => `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;

export const videoWatchUrl = (youtubeId: string) => `https://www.youtube.com/watch?v=${youtubeId}`;
