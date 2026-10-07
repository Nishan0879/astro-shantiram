// Shared by the admin and the public site, so it must stay free of server-only imports

export const galleryCategories = ["guruji", "temple", "puja", "events", "community", "spiritual", "travel"] as const;
export type GalleryCategory = (typeof galleryCategories)[number];

/**
 * Asks Cloudinary for a resized, compressed copy (WebP/AVIF where the browser supports it),
 * e.g. cloudinaryImage(url, "c_fill,w_600,h_600").
 */
export function cloudinaryImage(url: string, transform: string) {
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,${transform}/`);
}

export function youtubeId(url: string) {
  return url.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{6,})/)?.[1] ?? null;
}

export function youtubeThumbnail(url: string) {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function youtubeEmbed(url: string) {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
}

export type PublicGalleryItem = {
  id: string;
  kind: "photo" | "video";
  category: GalleryCategory;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  captionLocale: string | null;
};

export type GalleryList = { items: PublicGalleryItem[]; total: number; page: number; pageSize: number };
