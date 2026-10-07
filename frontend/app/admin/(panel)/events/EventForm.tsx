"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale, slugify } from "@/lib/articles";
import { type EventFormResult, type EventFormValues, saveEvent } from "../../event-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";

const languageNames: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

export const emptyEvent: EventFormValues = {
  slug: "",
  status: "draft",
  eventDate: "",
  startTime: "",
  endTime: "",
  registrationUrl: "",
  youtubeUrl: "",
  zoomUrl: "",
  translations: {
    en: { name: "", location: "", description: "" },
    ne: { name: "", location: "", description: "" },
    sa: { name: "", location: "", description: "" },
  },
};

type Field = Exclude<keyof EventFormValues, "translations" | "status">;

export default function EventForm({ id, initial }: { id: string | null; initial: EventFormValues }) {
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [tab, setTab] = useState<ContentLocale>(contentLocales.find((l) => initial.translations[l].name) ?? "en");
  const [result, setResult] = useState<EventFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const tabHasError = (l: ContentLocale) =>
    Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`translations.${l}.`));
  // Until edited by hand, the address follows the English name and the year
  const autoSlug = (v: EventFormValues) =>
    [slugify(v.translations.en.name), v.eventDate.slice(0, 4)].filter(Boolean).join("-");

  function update(next: (v: EventFormValues) => EventFormValues) {
    setValues((v) => {
      const n = next(v);
      return slugTouched ? n : { ...n, slug: autoSlug(n) };
    });
    setResult((r) => (r.ok ? {} : r));
  }

  const setField = (field: Field, value: string) => {
    if (field === "slug") setSlugTouched(true);
    update((v) => ({ ...v, [field]: value }));
  };
  const setTranslation = (field: "name" | "location" | "description", value: string) =>
    update((v) => ({ ...v, translations: { ...v.translations, [tab]: { ...v.translations[tab], [field]: value } } }));

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const slug = values.slug || autoSlug(values) || `event-${Date.now().toString(36)}`;
      const next = { ...values, slug, status };
      setValues(next);
      setResult(await saveEvent(id, next));
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

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Date
          <input type="date" value={values.eventDate} onChange={(e) => setField("eventDate", e.target.value)} className={fieldClass("eventDate")} />
          {fieldError("eventDate")}
        </label>
        <label className="block text-sm">
          Starts (Central time, optional)
          <input type="time" value={values.startTime} onChange={(e) => setField("startTime", e.target.value)} className={fieldClass("startTime")} />
          {fieldError("startTime")}
        </label>
        <label className="block text-sm">
          Ends (optional)
          <input type="time" value={values.endTime} onChange={(e) => setField("endTime", e.target.value)} className={fieldClass("endTime")} />
          {fieldError("endTime")}
        </label>
      </div>

      <div>
        <p className="text-sm text-charcoal/70">Name and describe the event in any languages you like.</p>
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
          Event name
          <input value={t.name} onChange={(e) => setTranslation("name", e.target.value)} maxLength={200} className={fieldClass(`translations.${tab}.name`)} />
          {fieldError(`translations.${tab}.name`)}
        </label>
        <label className="block text-sm">
          Location (optional)
          <input
            value={t.location}
            onChange={(e) => setTranslation("location", e.target.value)}
            maxLength={200}
            placeholder="e.g. DFW Hindu Temple, Irving, TX or Online"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Description (optional)
          <textarea value={t.description} onChange={(e) => setTranslation("description", e.target.value)} rows={8} className={inputClass} />
          <span className="mt-1 block text-xs text-charcoal/60">
            Leave a blank line between paragraphs. ## starts a heading, **bold**, - for a list.
          </span>
        </label>
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-medium">Links (optional, paste the full link)</legend>
        {(
          [
            ["registrationUrl", "Registration form"],
            ["zoomUrl", "Zoom meeting"],
            ["youtubeUrl", "YouTube video or live stream"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="block text-sm">
            {label}
            <input type="url" value={values[field]} onChange={(e) => setField(field, e.target.value)} placeholder="https://" className={fieldClass(field)} />
            {fieldError(field)}
          </label>
        ))}
      </fieldset>

      <label className="block text-sm">
        Web address
        <input value={values.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="mahashivaratri-2027" className={fieldClass("slug")} />
        <span className="mt-1 block break-all text-xs text-charcoal/60">/events/{values.slug || "…"}</span>
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
