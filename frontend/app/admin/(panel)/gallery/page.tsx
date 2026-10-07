/* eslint-disable @next/next/no-img-element -- Cloudinary resizes the images */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { cloudinaryImage, youtubeThumbnail } from "@/lib/media";
import AddMedia from "./AddMedia";
import { galleryCategoryNames } from "./names";

export const metadata: Metadata = { title: "Gallery" };

export type AdminGalleryItem = {
  id: string;
  kind: "photo" | "video";
  category: string;
  url: string;
  captions: Partial<Record<"en" | "ne" | "sa", string>>;
};

export default function GalleryAdminPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl text-maroon">Gallery</h1>
      <AddMedia />
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Items />
      </Suspense>
    </>
  );
}

async function Items() {
  const { items } = await adminJson<{ items: AdminGalleryItem[] }>("/api/admin/gallery");
  if (items.length === 0) {
    return <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">No photos yet.</p>;
  }

  return (
    <>
      <p className="mb-2 text-sm text-charcoal/70">Tap a photo to add a caption, change its topic or delete it.</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const thumb = item.kind === "photo" ? cloudinaryImage(item.url, "c_fill,w_300,h_300") : youtubeThumbnail(item.url);
          const caption = item.captions.en ?? item.captions.ne ?? item.captions.sa;
          return (
            <li key={item.id}>
              <Link href={`/admin/gallery/${item.id}`} className="group relative block aspect-square overflow-hidden rounded-lg bg-cream">
                {thumb && <img src={thumb} alt={caption ?? ""} loading="lazy" className="h-full w-full object-cover group-hover:opacity-90" />}
                {item.kind === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center text-3xl text-white drop-shadow">▶</span>
                )}
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                  {caption ?? galleryCategoryNames[item.category]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
