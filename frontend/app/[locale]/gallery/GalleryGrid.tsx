"use client";
/* eslint-disable @next/next/no-img-element -- Cloudinary and YouTube already serve sized images */

import { useCallback, useEffect, useRef, useState } from "react";
import { cloudinaryImage, type PublicGalleryItem, youtubeEmbed, youtubeThumbnail } from "@/lib/media";

type Labels = { close: string; previous: string; next: string; play: string };

function thumbnail(item: PublicGalleryItem) {
  return item.kind === "photo" ? cloudinaryImage(item.url, "c_fill,g_auto,w_480,h_480") : youtubeThumbnail(item.url);
}

export default function GalleryGrid({ items, labels }: { items: PublicGalleryItem[]; labels: Labels }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <ul className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-cream"
              aria-label={item.caption ?? (item.kind === "video" ? labels.play : undefined)}
            >
              {thumbnail(item) && (
                <img
                  src={thumbnail(item)!}
                  alt={item.caption ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              )}
              {item.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white">▶</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} labels={labels} />}
    </>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  labels,
}: {
  items: PublicGalleryItem[];
  index: number;
  onIndex: (i: number | null) => void;
  labels: Labels;
}) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = useCallback((step: number) => onIndex((index + step + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onIndex(null);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onIndex]);

  useEffect(() => closeRef.current?.focus(), []);

  // Swipe left or right on a phone
  const touchX = useRef<number | null>(null);

  const embed = item.kind === "video" ? youtubeEmbed(item.url) : null;
  const navClass = "rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/20";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption ?? undefined}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950"
      onClick={(e) => e.target === e.currentTarget && onIndex(null)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex justify-between p-3 text-sm text-white/70">
        <span className="self-center">
          {index + 1} / {items.length}
        </span>
        <button ref={closeRef} type="button" onClick={() => onIndex(null)} className={navClass}>
          ✕ {labels.close}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.target === e.currentTarget && onIndex(null)}>
        {embed ? (
          <iframe
            key={item.id}
            src={embed}
            title={item.caption ?? labels.play}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full max-w-4xl rounded-lg"
          />
        ) : (
          <img
            key={item.id}
            src={cloudinaryImage(item.url, "c_limit,w_1600,h_1600")}
            alt={item.caption ?? ""}
            className="max-h-full max-w-full rounded object-contain"
          />
        )}
      </div>

      <div className="space-y-3 p-3 text-center">
        {item.caption && (
          <p lang={item.captionLocale ?? undefined} className="mx-auto max-w-3xl text-white">
            {item.caption}
          </p>
        )}
        {items.length > 1 && (
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => go(-1)} className={navClass}>
              ← {labels.previous}
            </button>
            <button type="button" onClick={() => go(1)} className={navClass}>
              {labels.next} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
