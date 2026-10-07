import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteVideo } from "@/app/admin/video-actions";
import type { VideoFormValues } from "@/app/admin/video-actions";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import { videoWatchUrl } from "@/lib/videos";
import VideoForm from "../VideoForm";

export const metadata: Metadata = { title: "Edit video" };

type AdminVideo = Omit<VideoFormValues, "translations" | "publishedOn" | "youtubeUrl"> & {
  id: string;
  youtubeId: string;
  publishedOn: string | null;
  translations: Partial<Record<string, { title: string; description: string | null }>>;
};

export default function EditVideoPage({ params, searchParams }: PageProps<"/admin/videos/[id]">) {
  return (
    <>
      <Link href="/admin/videos" className="text-sm hover:text-saffron">
        ← All videos
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/videos/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading video failed: ${res.status}`);
  const { video } = (await res.json()) as { video: AdminVideo };

  const initial: VideoFormValues = {
    youtubeUrl: videoWatchUrl(video.youtubeId),
    kind: video.kind,
    status: video.status,
    category: video.category,
    language: video.language,
    publishedOn: video.publishedOn ?? "",
    featured: video.featured,
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = video.translations[l];
        return [l, { title: t?.title ?? "", description: t?.description ?? "" }];
      }),
    ) as VideoFormValues["translations"],
  };

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit video</h1>
        <div className="flex items-center gap-4">
          {video.status === "published" && (
            <a href={`/en/pravachan/${video.youtubeId}`} target="_blank" className="text-sm text-saffron-dark underline">
              View on site ↗
            </a>
          )}
          <DeleteButton
            action={deleteVideo.bind(null, video.id)}
            confirmText="Remove this video from the site? It stays on YouTube."
          />
        </div>
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {video.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <VideoForm id={video.id} initial={initial} youtubeId={video.youtubeId} />
      </div>
    </>
  );
}
