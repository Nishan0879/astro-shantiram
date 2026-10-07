"use client";

import { useState } from "react";
import { type UploadedPdf, uploadPdf } from "../../upload";
import { secondaryButtonClass } from "../../styles";

/** Picks the book's PDF and uploads it straight to Cloudinary. */
export default function PdfUpload({
  url,
  pageCount,
  error,
  onUploaded,
}: {
  url: string;
  pageCount: number | null;
  error?: string;
  onUploaded: (pdf: UploadedPdf) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      onUploaded(await uploadPdf(file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Uploading failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const shownError = uploadError ?? error;

  return (
    <div className="text-sm">
      <p>Book PDF</p>
      <p className="text-xs text-charcoal/60">Up to 10 MB on Cloudinary&apos;s free plan.</p>
      {url && (
        <p className="mt-2 rounded bg-cream p-3">
          PDF uploaded{pageCount ? ` · ${pageCount} pages` : ""} ·{" "}
          <a href={url} target="_blank" className="text-saffron-dark underline">
            open it
          </a>
        </p>
      )}
      <label className={`${secondaryButtonClass} mt-2 inline-block cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
        {uploading ? "Uploading…" : url ? "Replace the PDF" : "Choose the PDF"}
        <input
          type="file"
          accept="application/pdf,.pdf"
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
