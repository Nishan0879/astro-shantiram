import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate } from "@/lib/admin-api";
import { type VideoCategory, type VideoKind, videoThumbnail } from "@/lib/videos";
import { primaryButtonClass } from "../../styles";
import { videoCategoryNames, videoKindNames } from "./names";

export const metadata: Metadata = { title: "Videos" };

type AdminVideoRow = {
  id: string;
  youtubeId: string;
  title: string;
  kind: VideoKind;
  status: "draft" | "published";
  category: VideoCategory;
  featured: boolean;
  locales: string[];
  updatedAt: string;
};

export default function VideosAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Videos</h1>
        <Link href="/admin/videos/new" className={primaryButtonClass}>
          Add a video
        </Link>
      </div>
      <p className="mb-4 text-sm text-charcoal/70">
        Videos stay on YouTube. Paste a link here to show it on the Pravachan page.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <VideoRows />
      </Suspense>
    </>
  );
}

async function VideoRows() {
  const { videos } = await adminJson<{ videos: AdminVideoRow[] }>("/api/admin/videos");
  if (videos.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
        No videos yet. Tap “Add a video” and paste a YouTube link.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {videos.map((v) => (
        <li key={v.id}>
          <Link href={`/admin/videos/${v.id}`} className="flex gap-3 p-4 hover:bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube serves the thumbnail */}
            <img src={videoThumbnail(v.youtubeId, "mq")} alt="" className="aspect-video w-24 shrink-0 rounded bg-cream object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">
                  {v.featured && <span title="Featured">★ </span>}
                  {v.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    v.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                  }`}
                >
                  {v.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-xs text-charcoal/60">
                <span>
                  {videoCategoryNames[v.category]}
                  {v.kind !== "video" && ` · ${videoKindNames[v.kind]}`} · <span className="uppercase">{v.locales.join(" · ")}</span>
                </span>
                <span>Edited {formatDate(v.updatedAt)}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
