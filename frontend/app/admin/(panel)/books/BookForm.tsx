"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale, slugify } from "@/lib/articles";
import { bookCategories, bookLanguages } from "@/lib/books";
import { type BookFormResult, type BookFormValues, saveBook } from "../../book-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import CoverPhoto from "../articles/CoverPhoto";
import { bookCategoryNames, bookLanguageNames } from "./names";
import PdfUpload from "./PdfUpload";

const languageTabs: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

export const emptyBook: BookFormValues = {
  slug: "",
  status: "draft",
  category: "spirituality",
  language: "ne",
  publishedOn: "",
  featured: false,
  pdfUrl: "",
  pdfPublicId: "",
  pageCount: null,
  coverUrl: "",
  translations: {
    en: { title: "", author: "", description: "" },
    ne: { title: "", author: "", description: "" },
    sa: { title: "", author: "", description: "" },
  },
};

export default function BookForm({ id, initial }: { id: string | null; initial: BookFormValues }) {
  const [values, setValues] = useState(initial);
  // Keep the address in step with the English title until someone edits it by hand
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [tab, setTab] = useState<ContentLocale>(contentLocales.find((l) => initial.translations[l].title) ?? "en");
  const [result, setResult] = useState<BookFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const tabHasError = (l: ContentLocale) => Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));
  const set = <K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r.ok ? {} : r));
  };

  function setTranslation(locale: ContentLocale, field: "title" | "author" | "description", value: string) {
    setValues((v) => {
      const next = { ...v, translations: { ...v.translations, [locale]: { ...v.translations[locale], [field]: value } } };
      if (locale === "en" && field === "title" && !slugTouched) next.slug = slugify(value);
      return next;
    });
    setResult((r) => (r.ok ? {} : r));
  }

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const firstTitle = contentLocales.map((l) => values.translations[l].title).find(Boolean) ?? "";
      const slug = values.slug || slugify(firstTitle) || `book-${Date.now().toString(36)}`;
      const next = { ...values, slug, status };
      setValues(next);
      setResult(await saveBook(id, next));
    });
  }

  const t = values.translations[tab];
  const fieldClass = (path: string) => `${inputClass} ${err(path) ? "border-red-600" : ""}`;
  const fieldError = (path: string) => err(path) && <span className="text-red-700">{err(path)}</span>;

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

      <PdfUpload
        url={values.pdfUrl}
        pageCount={values.pageCount}
        error={err("pdfUrl")}
        onUploaded={(pdf) => {
          setValues((v) => ({ ...v, pdfUrl: pdf.url, pdfPublicId: pdf.publicId, pageCount: pdf.pages }));
          setResult((r) => ({ ...r, fieldErrors: { ...r.fieldErrors, pdfUrl: "" } }));
        }}
      />

      <div>
        <p className="text-sm text-charcoal/70">
          Title, author and description in any languages you like. Visitors see their own language when it exists.
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
          Author (optional)
          <input value={t.author} onChange={(e) => setTranslation(tab, "author", e.target.value)} maxLength={200} className={inputClass} />
        </label>
        <label className="block text-sm">
          Description (optional)
          <textarea value={t.description} onChange={(e) => setTranslation(tab, "description", e.target.value)} maxLength={5000} rows={5} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Topic
          <select value={values.category} onChange={(e) => set("category", e.target.value as BookFormValues["category"])} className={inputClass}>
            {bookCategories.map((c) => (
              <option key={c} value={c}>
                {bookCategoryNames[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Book is written in
          <select value={values.language} onChange={(e) => set("language", e.target.value as BookFormValues["language"])} className={inputClass}>
            {bookLanguages.map((l) => (
              <option key={l} value={l}>
                {bookLanguageNames[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Published on (optional)
          <input type="date" value={values.publishedOn} onChange={(e) => set("publishedOn", e.target.value)} className={fieldClass("publishedOn")} />
          {fieldError("publishedOn")}
        </label>
      </div>

      <CoverPhoto
        url={values.coverUrl}
        error={err("coverUrl")}
        folder="books"
        hint="Without one, the first page of the PDF is used."
        onChange={(coverUrl) => set("coverUrl", coverUrl)}
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-saffron" />
        Feature this book (shown first in the library)
      </label>

      <label className="block text-sm">
        Web address
        <input
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value);
          }}
          placeholder="notes-on-the-bhagavad-gita"
          className={fieldClass("slug")}
        />
        <span className="mt-1 block break-all text-xs text-charcoal/60">/books/{values.slug || "…"}</span>
        {fieldError("slug")}
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
