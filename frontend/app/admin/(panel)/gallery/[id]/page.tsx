/* eslint-disable @next/next/no-img-element -- Cloudinary resizes the images */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteGalleryItem } from "@/app/admin/media-actions";
import { adminJson } from "@/lib/admin-api";
import { cloudinaryImage, youtubeThumbnail } from "@/lib/media";
import type { AdminGalleryItem } from "../page";
import EditItem from "./EditItem";

export const metadata: Metadata = { title: "Gallery item" };

export default function GalleryItemPage({ params }: PageProps<"/admin/gallery/[id]">) {
  return (
    <>
      <Link href="/admin/gallery" className="text-sm hover:text-saffron">
        ← Gallery
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Item params={params} />
      </Suspense>
    </>
  );
}

async function Item({ params }: Pick<PageProps<"/admin/gallery/[id]">, "params">) {
  const { id } = await params;
  // The gallery is small, so the list doubles as the lookup
  const { items } = await adminJson<{ items: AdminGalleryItem[] }>("/api/admin/gallery");
  const item = items.find((i) => i.id === id);
  if (!item) notFound();
  const preview = item.kind === "photo" ? cloudinaryImage(item.url, "c_limit,w_900") : youtubeThumbnail(item.url);

  return (
    <div className="mt-4 space-y-4">
      {preview && <img src={preview} alt="" className="max-h-96 w-full rounded-xl bg-cream object-contain" />}
      {item.kind === "video" && (
        <a href={item.url} target="_blank" className="text-sm text-saffron-dark underline">
          Open on YouTube ↗
        </a>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <EditItem id={item.id} category={item.category} captions={item.captions} />
      </div>
      <DeleteButton
        action={deleteGalleryItem.bind(null, item.id)}
        confirmText={`Delete this ${item.kind} from the gallery? This cannot be undone.`}
      />
    </div>
  );
}
