import type { Metadata } from "next";
import Link from "next/link";
import VideoForm, { emptyVideo } from "../VideoForm";

export const metadata: Metadata = { title: "New video" };

export default function NewVideoPage() {
  return (
    <>
      <Link href="/admin/videos" className="text-sm hover:text-saffron">
        ← All videos
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New video</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <VideoForm id={null} initial={emptyVideo} />
      </div>
    </>
  );
}
