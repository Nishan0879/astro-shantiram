import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type VideoSummary, videoThumbnail } from "@/lib/videos";

/** A thumbnail and title that open the video's page on this site. */
export default function VideoCard({ video, large = false }: { video: VideoSummary; large?: boolean }) {
  const t = useTranslations("Pravachan");
  return (
    <Link href={`/pravachan/${video.youtubeId}`} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-charcoal shadow-sm group-hover:shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube serves the thumbnail */}
        <img src={videoThumbnail(video.youtubeId)} alt="" loading="lazy" className="aspect-video w-full object-cover opacity-95 group-hover:opacity-100" />
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon/85 text-xl text-white group-hover:bg-saffron">▶</span>
        </span>
        {video.kind !== "video" && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs uppercase text-white">{t(video.kind)}</span>
        )}
      </div>
      <h3 lang={video.locale} className={`mt-3 font-serif leading-snug text-maroon group-hover:text-saffron ${large ? "text-xl" : "text-lg"}`}>
        {video.title}
      </h3>
      <p className="mt-1 text-xs text-gold">{t(`categories.${video.category}`)}</p>
    </Link>
  );
}
