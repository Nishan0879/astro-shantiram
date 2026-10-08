"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale, slugify } from "@/lib/articles";
import { serviceCategories, serviceModes } from "@/lib/services";
import { type ServiceFormResult, type ServiceFormValues, saveService, type ServiceWriting } from "../../service-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import CoverPhoto from "../articles/CoverPhoto";
import { serviceCategoryNames, serviceModeNames } from "./names";

const languageTabs: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

const writingFields: { field: keyof ServiceWriting; label: string; hint?: string; rows?: number; max: number }[] = [
  { field: "name", label: "Name", max: 200 },
  { field: "summary", label: "Short summary (optional)", hint: "One or two sentences, shown on the services list.", rows: 3, max: 300 },
  { field: "description", label: "Full description (optional)", rows: 6, max: 10000 },
  { field: "purpose", label: "Purpose (optional)", hint: "Why people ask for it and what it helps with.", rows: 3, max: 5000 },
  { field: "requirements", label: "What to prepare (optional)", hint: "Birth details, puja items, space needed, and so on.", rows: 3, max: 5000 },
  { field: "location", label: "Location (optional)", hint: "For example: Dallas–Fort Worth area, or anywhere on Zoom.", max: 300 },
  { field: "availability", label: "Availability (optional)", hint: "For example: Weekends, or by appointment.", max: 300 },
];

export default function ServiceForm({ id, initial }: { id: string | null; initial: ServiceFormValues }) {
  const [values, setValues] = useState(initial);
  // Keep the address in step with the English name until someone edits it by hand
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [tab, setTab] = useState<ContentLocale>(contentLocales.find((l) => initial.translations[l].name) ?? "en");
  const [result, setResult] = useState<ServiceFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const tabHasError = (l: ContentLocale) => Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));
  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r.ok ? {} : r));
  };

  function setWriting(locale: ContentLocale, field: keyof ServiceWriting, value: string) {
    setValues((v) => {
      const next = { ...v, translations: { ...v.translations, [locale]: { ...v.translations[locale], [field]: value } } };
      if (locale === "en" && field === "name" && !slugTouched) next.slug = slugify(value);
      return next;
    });
    setResult((r) => (r.ok ? {} : r));
  }

  const hours = values.durationMinutes === null ? "" : String(Math.floor(values.durationMinutes / 60));
  const minutes = values.durationMinutes === null ? "" : String(values.durationMinutes % 60);
  function setDuration(h: string, m: string) {
    const total = (Number(h) || 0) * 60 + (Number(m) || 0);
    set("durationMinutes", h === "" && m === "" ? null : total);
  }

  function toggleMode(mode: (typeof serviceModes)[number], on: boolean) {
    set("modes", on ? [...values.modes, mode] : values.modes.filter((m) => m !== mode));
  }

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const firstName = contentLocales.map((l) => values.translations[l].name).find(Boolean) ?? "";
      const slug = values.slug || slugify(firstName) || `service-${Date.now().toString(36)}`;
      const next = { ...values, slug, status };
      setValues(next);
      setResult(await saveService(id, next));
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Kind of service
          <select value={values.category} onChange={(e) => set("category", e.target.value as ServiceFormValues["category"])} className={inputClass}>
            {serviceCategories.map((c) => (
              <option key={c} value={c}>
                {serviceCategoryNames[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Position in the list
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={values.sortOrder}
            onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className={fieldClass("sortOrder")}
          />
          <span className="mt-1 block text-xs text-charcoal/60">Lower numbers are shown first.</span>
        </label>
      </div>

      <div>
        <p className="text-sm text-charcoal/70">Write in any languages you like. Visitors see their own language when it exists.</p>
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
              {values.translations[l].name && " ✓"}
              {tabHasError(l) && <span className="ml-1 text-red-700">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div lang={tab} className="space-y-4">
        {writingFields.map(({ field, label, hint, rows, max }) => {
          const path = `translations.${tab}.${field}`;
          return (
            <label key={field} className="block text-sm">
              {label}
              {hint && <span className="block text-xs text-charcoal/60">{hint}</span>}
              {rows ? (
                <textarea value={t[field]} onChange={(e) => setWriting(tab, field, e.target.value)} maxLength={max} rows={rows} className={fieldClass(path)} />
              ) : (
                <input value={t[field]} onChange={(e) => setWriting(tab, field, e.target.value)} maxLength={max} className={fieldClass(path)} />
              )}
              {fieldError(path)}
            </label>
          );
        })}
      </div>

      <fieldset className="grid gap-4 rounded-lg border border-gold/30 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Price and length</legend>
        <div className="text-sm">
          <label className="block">
            Price in US dollars
            <span className="mt-1 flex items-center gap-1">
              <span className="text-charcoal/60">$</span>
              <input
                inputMode="decimal"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="151"
                className={fieldClass("price")}
              />
            </span>
          </label>
          <span className="mt-1 block text-xs text-charcoal/60">Leave empty to show “Ask for the price”.</span>
          {fieldError("price")}
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={values.priceFrom} onChange={(e) => set("priceFrom", e.target.checked)} className="h-4 w-4 accent-saffron" />
            Starting price (shows “From $151”)
          </label>
        </div>
        <div className="text-sm">
          <p>How long it takes (optional)</p>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={hours}
              onChange={(e) => setDuration(e.target.value, minutes)}
              aria-label="Hours"
              className={`${fieldClass("durationMinutes")} w-20`}
            />
            <span>hr</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={5}
              value={minutes}
              onChange={(e) => setDuration(hours, e.target.value)}
              aria-label="Minutes"
              className={`${fieldClass("durationMinutes")} w-20`}
            />
            <span>min</span>
          </div>
          {fieldError("durationMinutes")}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-gold/30 p-4 text-sm">
        <legend className="px-1 font-medium">How it is offered</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {serviceModes.map((mode) => (
            <label key={mode} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.modes.includes(mode)}
                onChange={(e) => toggleMode(mode, e.target.checked)}
                className="h-4 w-4 accent-saffron"
              />
              {serviceModeNames[mode]}
            </label>
          ))}
        </div>
      </fieldset>

      <CoverPhoto url={values.imageUrl} error={err("imageUrl")} folder="services" label="Photo" onChange={(imageUrl) => set("imageUrl", imageUrl)} />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.bookingOpen} onChange={(e) => set("bookingOpen", e.target.checked)} className="h-4 w-4 accent-saffron" />
        Taking requests (untick to show “Not taking requests right now”)
      </label>

      <label className="block text-sm">
        Web address
        <input
          value={values.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value);
          }}
          placeholder="rudrabhishek"
          className={fieldClass("slug")}
        />
        <span className="mt-1 block break-all text-xs text-charcoal/60">/services/{values.slug || "…"}</span>
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
