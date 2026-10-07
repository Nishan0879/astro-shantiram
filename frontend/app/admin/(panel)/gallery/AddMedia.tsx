"use client";

import { useState, useTransition } from "react";
import { galleryCategories, type GalleryCategory } from "@/lib/media";
import { addGalleryItem } from "../../media-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import { uploadPhoto } from "../../upload";
import { galleryCategoryNames } from "./names";

export default function AddMedia() {
  const [category, setCategory] = useState<GalleryCategory>("puja");
  const [videoUrl, setVideoUrl] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setErrors([]);
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of list.entries()) {
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        try {
          const photo = await uploadPhoto(file, "gallery");
          const saved = await addGalleryItem({ kind: "photo", category, ...photo });
          if (saved.error) failed.push(`${file.name}: ${saved.error}`);
        } catch (err) {
          failed.push(err instanceof Error ? err.message : `${file.name} failed.`);
        }
      }
      setProgress(failed.length ? null : `Added ${list.length} ${list.length === 1 ? "photo" : "photos"}.`);
      setErrors(failed);
    });
  }

  function addVideo() {
    setErrors([]);
    startTransition(async () => {
      const saved = await addGalleryItem({ kind: "video", url: videoUrl.trim(), category });
      if (saved.error) setErrors([saved.error]);
      else {
        setVideoUrl("");
        setProgress("Added the video.");
      }
    });
  }

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-gold/30 bg-warm-white p-5">
      <label className="block text-sm">
        Topic for new photos and videos
        <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)} className={inputClass}>
          {galleryCategories.map((c) => (
            <option key={c} value={c}>
              {galleryCategoryNames[c]}
            </option>
          ))}
        </select>
      </label>

      <label className={`${primaryButtonClass} inline-block cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}>
        Add photos
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 text-sm">
          Or add a YouTube video
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className={inputClass}
          />
        </label>
        <button type="button" disabled={pending || !videoUrl.trim()} onClick={addVideo} className={secondaryButtonClass}>
          Add video
        </button>
      </div>

      {progress && <p className="text-sm text-charcoal/80">{progress}</p>}
      {errors.map((e) => (
        <p key={e} className="rounded bg-red-50 p-3 text-sm text-red-800">
          {e}
        </p>
      ))}
    </section>
  );
}
