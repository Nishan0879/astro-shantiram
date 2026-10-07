import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import VideoCard from "@/components/VideoCard";
import { Link } from "@/i18n/navigation";
import { publicJson } from "@/lib/public-api";
import { type PublicVideo, type VideoList, videoEmbed, videoThumbnail, videoWatchUrl } from "@/lib/videos";

async function getVideo(id: string, locale: string) {
  const data = await publicJson<{ video: PublicVideo }>(`/api/videos/${encodeURIComponent(id)}?locale=${locale}`);
  return data?.video ?? null;
}

async function getCachedMeta(id: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  try {
    const video = await getVideo(id, locale);
    if (!video) return null;
    return {
      title: video.title,
      description: video.description?.slice(0, 200) ?? undefined,
      openGraph: { images: [videoThumbnail(video.youtubeId)] },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/pravachan/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const meta = await getCachedMeta(id, locale);
  if (meta) return meta;
  const t = await getTranslations({ locale, namespace: "Pravachan" });
  return { title: t("title") };
}

export default function VideoPage({ params }: PageProps<"/[locale]/pravachan/[id]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Suspense fallback={<div className="aspect-video w-full" />}>
        <VideoDetails params={params} />
      </Suspense>
    </div>
  );
}

async function VideoDetails({ params }: Pick<PageProps<"/[locale]/pravachan/[id]">, "params">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const video = await getVideo(id, locale);
  if (!video) notFound();
  const t = await getTranslations({ locale, namespace: "Pravachan" });
  const format = await getFormatter({ locale });
  const related = await publicJson<VideoList>(`/api/videos?locale=${locale}&category=${video.category}&limit=4`);
  const more = (related?.videos ?? []).filter((v) => v.youtubeId !== video.youtubeId).slice(0, 3);

  // Lets search engines show this as a video result
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description || video.title,
    thumbnailUrl: [videoThumbnail(video.youtubeId)],
    uploadDate: video.publishedOn ?? video.createdAt,
    embedUrl: videoEmbed(video.youtubeId),
    contentUrl: videoWatchUrl(video.youtubeId),
    inLanguage: video.language,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Link href="/pravachan" className="text-sm text-saffron hover:underline">
        ← {t("back")}
      </Link>
      <div className={`mx-auto mt-6 overflow-hidden rounded-xl bg-black shadow-md ${video.kind === "short" ? "max-w-sm" : ""}`}>
        <iframe
          src={videoEmbed(video.youtubeId)}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className={`w-full ${video.kind === "short" ? "aspect-[9/16]" : "aspect-video"}`}
        />
      </div>
      {video.locale !== locale && (
        <p className="mt-6 rounded-lg bg-cream p-4 text-sm">
          {t("otherLanguage", { language: t(`languages.${video.locale}`) })}
        </p>
      )}
      <div lang={video.locale} className="mt-6">
        <p className="text-sm text-gold" lang={locale}>
          {t(`categories.${video.category}`)} · {t(`languages.${video.language}`)}
          {video.publishedOn &&
            ` · ${format.dateTime(new Date(`${video.publishedOn}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" })}`}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-maroon sm:text-4xl">{video.title}</h1>
        {video.description && <div className="mt-4 whitespace-pre-line leading-relaxed">{video.description}</div>}
        <a
          href={videoWatchUrl(video.youtubeId)}
          target="_blank"
          rel="noopener"
          lang={locale}
          className="mt-6 inline-block text-saffron hover:underline"
        >
          {t("watchOnYoutube")} ↗
        </a>
      </div>

      {more.length > 0 && (
        <section className="mt-14 border-t border-gold/30 pt-8">
          <h2 className="font-serif text-2xl text-maroon">{t("more", { topic: t(`categories.${video.category}`) })}</h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-3">
            {more.map((v) => (
              <li key={v.youtubeId}>
                <VideoCard video={v} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
