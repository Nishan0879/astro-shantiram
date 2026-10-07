import { z } from "zod";
import { bookLanguages, contentLocales, videoCategories, videoKinds } from "../db/schema.js";

/**
 * The 11-character video id from any YouTube link (watch, youtu.be, shorts, live, embed),
 * or from a bare id. Null when it is not a YouTube video.
 */
export function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null | undefined;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Shorts and live links say what they are; anything else is a regular video. */
export function youtubeKind(input: string): (typeof videoKinds)[number] {
  if (/\/shorts\//.test(input)) return "short";
  if (/\/live\//.test(input)) return "live";
  return "video";
}

const translationSchema = z.object({
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
});

export const videoInputSchema = z
  .object({
    youtubeUrl: z
      .string()
      .trim()
      .refine((v) => parseYoutubeId(v) !== null, "Paste a YouTube link, like https://www.youtube.com/watch?v=…"),
    kind: z.enum(videoKinds),
    status: z.enum(["draft", "published"]),
    category: z.enum(videoCategories),
    language: z.enum(bookLanguages),
    publishedOn: z
      .union([z.iso.date(), z.literal("")])
      .default("")
      .transform((v) => v || null),
    featured: z.boolean().default(false),
    translations: z.partialRecord(z.enum(contentLocales), translationSchema),
  })
  .superRefine((input, ctx) => {
    let filled = 0;
    for (const locale of contentLocales) {
      const t = input.translations[locale];
      if (!t || (!t.title && !t.description)) continue;
      filled++;
      if (!t.title) ctx.addIssue({ code: "custom", path: ["translations", locale, "title"], message: "Add a title" });
    }
    if (filled === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Add the title in at least one language" });
    }
  });

export type VideoInput = z.infer<typeof videoInputSchema>;

/** The video id of input that passed validation. */
export const inputYoutubeId = (input: VideoInput) => parseYoutubeId(input.youtubeUrl) as string;

/** The translations that have a title, as rows ready to insert. */
export function videoTranslationRows(videoId: string, input: VideoInput) {
  return contentLocales.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t?.title) return [];
    return [{ videoId, locale, title: t.title, description: t.description || null }];
  });
}

export type YoutubeDetails = { youtubeId: string; kind: (typeof videoKinds)[number]; title: string | null; channel: string | null };

/**
 * Reads a video's title from YouTube's public oEmbed endpoint (no API key needed).
 * The title is a convenience, so any failure just leaves it empty.
 */
export async function lookupYoutube(link: string, fetchImpl: typeof fetch = fetch): Promise<YoutubeDetails | null> {
  const youtubeId = parseYoutubeId(link);
  if (!youtubeId) return null;
  const details: YoutubeDetails = { youtubeId, kind: youtubeKind(link), title: null, channel: null };
  try {
    const watch = `https://www.youtube.com/watch?v=${youtubeId}`;
    const res = await fetchImpl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = (await res.json()) as { title?: unknown; author_name?: unknown };
      if (typeof body.title === "string") details.title = body.title.slice(0, 200);
      if (typeof body.author_name === "string") details.channel = body.author_name.slice(0, 200);
    }
  } catch {
    // Offline or blocked: the admin types the title instead
  }
  return details;
}
