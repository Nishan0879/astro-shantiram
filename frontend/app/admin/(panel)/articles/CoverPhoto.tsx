"use client";

import { useState } from "react";
import { cloudinaryImage, type UploadFolder } from "@/lib/media";
import { uploadPhoto } from "../../upload";
import { secondaryButtonClass } from "../../styles";

/** Optional photo shown at the top of the article and in the list. */
export default function CoverPhoto({
  url,
  error,
  onChange,
  folder = "articles",
  hint,
  label = "Cover photo",
}: {
  url: string;
  error?: string;
  onChange: (url: string) => void;
  folder?: Exclude<UploadFolder, "gallery">;
  label?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      onChange((await uploadPhoto(file, folder)).url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Uploading failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const shownError = uploadError ?? error;

  return (
    <div className="text-sm">
      <p>{label} (optional)</p>
      {hint && <p className="text-xs text-charcoal/60">{hint}</p>}
      {url ? (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary already resizes it */}
          <img src={cloudinaryImage(url, "c_fill,w_480,h_270")} alt={label} className="w-60 rounded-lg border border-gold/30" />
          <button type="button" onClick={() => onChange("")} className={secondaryButtonClass}>
            Remove photo
          </button>
        </div>
      ) : null}
      <label className={`${secondaryButtonClass} mt-2 inline-block cursor-pointer`}>
        {uploading ? "Uploading…" : url ? "Choose a different photo" : "Add a photo"}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      {shownError && <p className="mt-1 text-red-700">{shownError}</p>}
    </div>
  );
}
