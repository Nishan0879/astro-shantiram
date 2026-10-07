"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { galleryCategories, type GalleryCategory } from "@/lib/media";
import { type GalleryResult, updateGalleryItem } from "../../../media-actions";
import { inputClass, primaryButtonClass } from "../../../styles";
import { galleryCategoryNames } from "../names";

const languageNames: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

export default function EditItem({
  id,
  category: initialCategory,
  captions: initialCaptions,
}: {
  id: string;
  category: string;
  captions: Partial<Record<ContentLocale, string>>;
}) {
  const [category, setCategory] = useState(initialCategory as GalleryCategory);
  const [captions, setCaptions] = useState(initialCaptions);
  const [result, setResult] = useState<GalleryResult>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await updateGalleryItem(id, category, captions)));
      }}
      className="space-y-4"
    >
      {result.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
      {result.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Saved.</p>}
      <label className="block text-sm">
        Topic
        <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)} className={inputClass}>
          {galleryCategories.map((c) => (
            <option key={c} value={c}>
              {galleryCategoryNames[c]}
            </option>
          ))}
        </select>
      </label>
      {contentLocales.map((l) => (
        <label key={l} lang={l} className="block text-sm">
          Caption in {languageNames[l]} (optional)
          <input
            value={captions[l] ?? ""}
            maxLength={300}
            onChange={(e) => {
              setCaptions((c) => ({ ...c, [l]: e.target.value }));
              setResult({});
            }}
            className={inputClass}
          />
        </label>
      ))}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
