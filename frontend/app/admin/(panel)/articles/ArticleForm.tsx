"use client";

import { useState, useTransition } from "react";
import { articleCategories, contentLocales, type ContentLocale, slugify } from "@/lib/articles";
import { type ArticleFormResult, type ArticleFormValues, saveArticle } from "../../article-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import CoverPhoto from "./CoverPhoto";

const languageNames: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };
const categoryNames: Record<string, string> = {
  astrology: "Astrology",
  spiritual: "Spiritual teachings",
  festivals: "Festivals",
  sanskrit: "Sanskrit meanings",
  culture: "Nepali culture",
  puja: "Puja",
  dharma: "Dharma",
  guidance: "Astrology guidance",
};

export const emptyArticle: ArticleFormValues = {
  slug: "",
  category: "astrology",
  status: "draft",
  coverUrl: "",
  translations: {
    en: { title: "", summary: "", body: "" },
    ne: { title: "", summary: "", body: "" },
    sa: { title: "", summary: "", body: "" },
  },
};

export default function ArticleForm({ id, initial }: { id: string | null; initial: ArticleFormValues }) {
  const [values, setValues] = useState(initial);
  // Keep the address in step with the English title until someone edits it by hand
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [tab, setTab] = useState<ContentLocale>(
    contentLocales.find((l) => initial.translations[l].title) ?? "en",
  );
  const [result, setResult] = useState<ArticleFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const tabHasError = (l: ContentLocale) =>
    Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));

  function setTranslation(locale: ContentLocale, field: "title" | "summary" | "body", value: string) {
    setValues((v) => {
      const next = { ...v, translations: { ...v.translations, [locale]: { ...v.translations[locale], [field]: value } } };
      if (locale === "en" && field === "title" && !slugTouched) next.slug = slugify(value);
      return next;
    });
    setResult((r) => (r.ok ? {} : r));
  }

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const slug = values.slug || slugify(values.translations.en.title) || `article-${Date.now().toString(36)}`;
      const next = { ...values, slug, status };
      setValues(next);
      setResult(await saveArticle(id, next));
    });
  }

  const t = values.translations[tab];

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

      <div>
        <p className="text-sm text-charcoal/70">
          Write in any languages you like. Visitors see their own language when it exists, otherwise another one.
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
              {languageNames[l]}
              {values.translations[l].title && " ✓"}
              {tabHasError(l) && <span className="ml-1 text-red-700">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div lang={tab} className="space-y-4">
        <label className="block text-sm">
          Title
          <input
            value={t.title}
            onChange={(e) => setTranslation(tab, "title", e.target.value)}
            maxLength={200}
            className={`${inputClass} ${err(`translations.${tab}.title`) ? "border-red-600" : ""}`}
          />
          {err(`translations.${tab}.title`) && <span className="text-red-700">{err(`translations.${tab}.title`)}</span>}
        </label>
        <label className="block text-sm">
          Short summary (optional, shown in the list)
          <textarea
            value={t.summary}
            onChange={(e) => setTranslation(tab, "summary", e.target.value)}
            maxLength={500}
            rows={2}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Article text
          <textarea
            value={t.body}
            onChange={(e) => setTranslation(tab, "body", e.target.value)}
            rows={14}
            className={`${inputClass} ${err(`translations.${tab}.body`) ? "border-red-600" : ""}`}
          />
          {err(`translations.${tab}.body`) && <span className="text-red-700">{err(`translations.${tab}.body`)}</span>}
          <span className="mt-1 block text-xs text-charcoal/60">
            Leave a blank line between paragraphs. ## starts a heading, **bold**, *italic*, - for a list.
          </span>
        </label>
      </div>

      <CoverPhoto
        url={values.coverUrl}
        error={err("coverUrl")}
        onChange={(coverUrl) => setValues((v) => ({ ...v, coverUrl }))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Topic
          <select
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as ArticleFormValues["category"] }))}
            className={inputClass}
          >
            {articleCategories.map((c) => (
              <option key={c} value={c}>
                {categoryNames[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Web address
          <input
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValues((v) => ({ ...v, slug: e.target.value }));
            }}
            placeholder="meaning-of-maha-shivaratri"
            className={`${inputClass} ${err("slug") ? "border-red-600" : ""}`}
          />
          <span className="mt-1 block break-all text-xs text-charcoal/60">/articles/{values.slug || "…"}</span>
          {err("slug") && <span className="text-red-700">{err("slug")}</span>}
        </label>
      </div>

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
