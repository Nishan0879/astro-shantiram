"use client";
/* eslint-disable @next/next/no-img-element -- YouTube serves the thumbnail */

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { bookLanguages } from "@/lib/books";
import { videoCategories, videoKinds, videoThumbnail } from "@/lib/videos";
import { lookupVideo, saveVideo, type VideoFormResult, type VideoFormValues, type VideoLookup } from "../../video-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import { bookLanguageNames } from "../books/names";
import { videoCategoryNames, videoKindNames } from "./names";

const languageTabs: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

export const emptyVideo: VideoFormValues = {
  youtubeUrl: "",
  kind: "video",
  status: "draft",
  category: "gita",
  language: "ne",
  publishedOn: "",
  featured: false,
  translations: {
    en: { title: "", description: "" },
    ne: { title: "", description: "" },
    sa: { title: "", description: "" },
  },
};

export default function VideoForm({ id, initial, youtubeId }: { id: string | null; initial: VideoFormValues; youtubeId?: string }) {
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState<ContentLocale>(contentLocales.find((l) => initial.translations[l].title) ?? "en");
  const [result, setResult] = useState<VideoFormResult>({});
  const [lookup, setLookup] = useState<VideoLookup | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();
  const lastChecked = useRef(initial.youtubeUrl);
  const previewId = lookup?.youtubeId ?? youtubeId;

  const err = (path: string) => result.fieldErrors?.[path];
  const tabHasError = (l: ContentLocale) => Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));
  const set = <K extends keyof VideoFormValues>(key: K, value: VideoFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r.ok ? {} : r));
  };

  function setTranslation(locale: ContentLocale, field: "title" | "description", value: string) {
    setValues((v) => ({ ...v, translations: { ...v.translations, [locale]: { ...v.translations[locale], [field]: value } } }));
    setResult((r) => (r.ok ? {} : r));
  }

  // Ask YouTube for the title as soon as a link is pasted
  async function checkLink(link: string) {
    if (link.trim() === lastChecked.current.trim()) return;
    lastChecked.current = link;
    if (!link.trim()) return setLookup(null);
    setChecking(true);
    const found = await lookupVideo(link).catch(() => null);
    setChecking(false);
    setLookup(found);
    setResult(({ fieldErrors, ...r }) => ({ ...r, fieldErrors: { ...fieldErrors, youtubeUrl: found ? "" : "This is not a YouTube video link" } }));
    if (!found) return;
    setValues((v) => {
      const next = { ...v, kind: found.kind };
      // Fill the title only where nothing has been typed yet
      if (found.title && !contentLocales.some((l) => v.translations[l].title)) {
        next.translations = { ...v.translations, [tab]: { ...v.translations[tab], title: found.title } };
      }
      return next;
    });
  }

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const next = { ...values, status };
      setValues(next);
      setResult(await saveVideo(id, next));
    });
  }

  const t = values.translations[tab];
  const fieldClass = (path: string) => `${inputClass} ${err(path) ? "border-red-600" : ""}`;
  const fieldError = (path: string) => err(path) && <span className="text-red-700">{err(path)}</span>;
  const duplicate = lookup?.existingId && lookup.existingId !== id ? lookup.existingId : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(values.status);
      }}
      className="space-y-5"
    >
      {result.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
      {err("translations") && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{err("translations")}</p>}
      {result.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Saved.</p>}

      <label className="block text-sm">
        YouTube link
        <input
          value={values.youtubeUrl}
          onChange={(e) => set("youtubeUrl", e.target.value)}
          onBlur={(e) => checkLink(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            // Let the paste land first, then look it up
            setTimeout(() => checkLink(pasted), 0);
          }}
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          className={fieldClass("youtubeUrl")}
        />
        <span className="mt-1 block text-xs text-charcoal/60">
          On YouTube, tap Share, then Copy link, and paste it here.
        </span>
        {checking && <span className="text-charcoal/60">Checking the link…</span>}
        {fieldError("youtubeUrl")}
      </label>

      {duplicate && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          This video is already on the site.{" "}
          <Link href={`/admin/videos/${duplicate}`} className="underline">
            Open it
          </Link>
        </p>
      )}

      {previewId && (
        <div className="flex items-center gap-3">
          <img src={videoThumbnail(previewId, "mq")} alt="" className="w-40 rounded-lg border border-gold/30" />
          {lookup?.channel && <span className="text-sm text-charcoal/70">From {lookup.channel}</span>}
        </div>
      )}

      <div>
        <p className="text-sm text-charcoal/70">
          Title and description in any languages you like. Visitors see their own language when it exists.
        </p>
        <div className="mt-2 flex gap-1 border-b border-gold/30">
          {contentLocales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setTab(l)}
              className={`-mb-px rounded-t border px-3 py-2 text-sm ${
                tab === l ? "border-gold/30 border-b-warm-white bg-warm-white font-medium" : "border-transparent text-charcoal/70"
              }`}
            >
              {languageTabs[l]}
              {values.translations[l].title && " ✓"}
              {tabHasError(l) && <span className="ml-1 text-red-700">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div lang={tab} className="space-y-4">
        <label className="block text-sm">
          Title
          <input value={t.title} onChange={(e) => setTranslation(tab, "title", e.target.value)} maxLength={200} className={fieldClass(`translations.${tab}.title`)} />
          {fieldError(`translations.${tab}.title`)}
        </label>
        <label className="block text-sm">
          Description (optional)
          <textarea value={t.description} onChange={(e) => setTranslation(tab, "description", e.target.value)} maxLength={5000} rows={4} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Topic
          <select value={values.category} onChange={(e) => set("category", e.target.value as VideoFormValues["category"])} className={inputClass}>
            {videoCategories.map((c) => (
              <option key={c} value={c}>
                {videoCategoryNames[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Spoken in
          <select value={values.language} onChange={(e) => set("language", e.target.value as VideoFormValues["language"])} className={inputClass}>
            {bookLanguages.map((l) => (
              <option key={l} value={l}>
                {bookLanguageNames[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Type
          <select value={values.kind} onChange={(e) => set("kind", e.target.value as VideoFormValues["kind"])} className={inputClass}>
            {videoKinds.map((k) => (
              <option key={k} value={k}>
                {videoKindNames[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Date on YouTube (optional)
          <input type="date" value={values.publishedOn} onChange={(e) => set("publishedOn", e.target.value)} className={fieldClass("publishedOn")} />
          {fieldError("publishedOn")}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-saffron" />
        Feature this video (shown at the top of the Pravachan page)
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-gold/20 pt-4">
        <button type="button" disabled={pending} onClick={() => submit("published")} className={primaryButtonClass}>
          {pending ? "Saving…" : values.status === "published" && id ? "Save changes" : "Publish"}
        </button>
        <button type="button" disabled={pending} onClick={() => submit("draft")} className={secondaryButtonClass}>
          {values.status === "published" && id ? "Unpublish (make draft)" : "Save as draft"}
        </button>
      </div>
    </form>
  );
}
