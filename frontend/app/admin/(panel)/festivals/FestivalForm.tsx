"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { festivalKinds } from "@/lib/festivals";
import { type FestivalFormResult, type FestivalFormValues, saveFestival } from "../../festival-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import { festivalKindNames } from "./names";

const languageNames: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

export const emptyFestival: FestivalFormValues = {
  date: "",
  endDate: "",
  kind: "festival",
  status: "published",
  serviceSlug: "",
  translations: { en: { name: "", description: "" }, ne: { name: "", description: "" }, sa: { name: "", description: "" } },
};

export default function FestivalForm({
  id,
  initial,
  services,
}: {
  id: string | null;
  initial: FestivalFormValues;
  services: { slug: string; name: string }[];
}) {
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState<ContentLocale>(contentLocales.find((l) => initial.translations[l].name) ?? "en");
  const [result, setResult] = useState<FestivalFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const fieldClass = (path: string) => `${inputClass} ${err(path) ? "border-red-600" : ""}`;
  const fieldError = (path: string) => err(path) && <span className="text-red-700">{err(path)}</span>;
  const tabHasError = (l: ContentLocale) => Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));

  function set<K extends keyof FestivalFormValues>(key: K, value: FestivalFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r.ok ? {} : r));
  }
  const setTranslation = (field: "name" | "description", value: string) =>
    set("translations", { ...values.translations, [tab]: { ...values.translations[tab], [field]: value } });

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const next = { ...values, status };
      setValues(next);
      setResult(await saveFestival(id, next));
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

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Date
          <input type="date" value={values.date} onChange={(e) => set("date", e.target.value)} className={fieldClass("date")} />
          {fieldError("date")}
        </label>
        <label className="block text-sm">
          Last day (only if it runs several days)
          <input type="date" value={values.endDate} onChange={(e) => set("endDate", e.target.value)} className={fieldClass("endDate")} />
          {fieldError("endDate")}
        </label>
        <label className="block text-sm">
          Kind of day
          <select value={values.kind} onChange={(e) => set("kind", e.target.value as FestivalFormValues["kind"])} className={fieldClass("kind")}>
            {festivalKinds.map((k) => (
              <option key={k} value={k}>
                {festivalKindNames[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="text-sm text-charcoal/70">Name the day in any languages you like. Visitors see their own language when it is filled in.</p>
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
              {values.translations[l].name && " ✓"}
              {tabHasError(l) && <span className="ml-1 text-red-700">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div lang={tab} className="space-y-4">
        <label className="block text-sm">
          Name
          <input value={t.name} onChange={(e) => setTranslation("name", e.target.value)} maxLength={200} className={fieldClass(`translations.${tab}.name`)} />
          {fieldError(`translations.${tab}.name`)}
        </label>
        <label className="block text-sm">
          A few words about it (optional)
          <textarea value={t.description} onChange={(e) => setTranslation("description", e.target.value)} rows={4} className={inputClass} />
        </label>
      </div>

      <label className="block text-sm">
        Offer a booking for this service (optional)
        <select value={values.serviceSlug} onChange={(e) => set("serviceSlug", e.target.value)} className={inputClass}>
          <option value="">No booking link</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-charcoal/60">Visitors see a “Book this puja” link next to the day.</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-gold/20 pt-4">
        <button type="button" disabled={pending} onClick={() => submit("published")} className={primaryButtonClass}>
          {pending ? "Saving…" : values.status === "published" && id ? "Save changes" : "Publish"}
        </button>
        <button type="button" disabled={pending} onClick={() => submit("draft")} className={secondaryButtonClass}>
          {values.status === "published" && id ? "Hide from the site (draft)" : "Save as draft"}
        </button>
      </div>
    </form>
  );
}
