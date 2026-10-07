import type { VideoCategory, VideoKind } from "@/lib/videos";

export const videoCategoryNames: Record<VideoCategory, string> = {
  gita: "Bhagavad Gita",
  vedas: "Vedas",
  upanishads: "Upanishads",
  puranas: "Puranas",
  dharma: "Sanatan Dharma",
  spirituality: "Spirituality",
  culture: "Nepali culture",
  festivals: "Festival teachings",
  astrology: "Astrology",
  puja: "Puja",
  other: "Other",
};

export const videoKindNames: Record<VideoKind, string> = {
  video: "Video",
  short: "Short",
  live: "Live stream",
};
