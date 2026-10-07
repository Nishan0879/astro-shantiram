"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { horoscopePeriods, readingFields, signInfo, type ZodiacSign, zodiacSigns } from "@/lib/horoscopes";
import { type HoroscopeFormResult, type HoroscopeFormValues, type ReadingValues, saveHoroscope } from "../../horoscope-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import { fieldNames, periodNames, signNames } from "./names";

const languageTabs: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

const hasWriting = (r: ReadingValues) => readingFields.some((f) => r[f].trim());

export default function HoroscopeForm({ id, initial }: { id: string | null; initial: HoroscopeFormValues }) {
  const [values, setValues] = useState(initial);
  const [locale, setLocale] = useState<ContentLocale>(
    contentLocales.find((l) => zodiacSigns.some((s) => hasWriting(initial.readings[s][l]))) ?? "en",
  );
  const [sign, setSign] = useState<ZodiacSign>("mesha");
  const [result, setResult] = useState<HoroscopeFormResult>({});
  const [pending, startTransition] = useTransition();

  const err = (path: string) => result.fieldErrors?.[path];
  const signHasError = (s: ZodiacSign) => Object.keys(result.fieldErrors ?? {}).some((k) => k.startsWith(`readings.${s}.`));
  const localeHasError = (l: ContentLocale) =>
    Object.keys(result.fieldErrors ?? {}).some((k) => k.endsWith(`.${l}.overview`) || k.startsWith(`translations.${l}`));
  const clearResult = () => setResult((r) => (r.ok ? {} : r));
  const special = values.period === "festival" || values.period === "special";

  function setReading(field: keyof ReadingValues, value: string) {
    setValues((v) => ({
      ...v,
      readings: { ...v.readings, [sign]: { ...v.readings[sign], [locale]: { ...v.readings[sign][locale], [field]: value } } },
    }));
    clearResult();
  }

  function setTranslation(field: "title" | "intro", value: string) {
    setValues((v) => ({ ...v, translations: { ...v.translations, [locale]: { ...v.translations[locale], [field]: value } } }));
    clearResult();
  }

  function submit(status: "draft" | "published") {
    startTransition(async () => {
      const next = { ...values, status };
      setValues(next);
      const saved = await saveHoroscope(id, next);
      setResult(saved);
      // Jump to the first sign with a problem
      const bad = zodiacSigns.find((s) => Object.keys(saved.fieldErrors ?? {}).some((k) => k.startsWith(`readings.${s}.`)));
      if (bad) setSign(bad);
    });
  }

  const reading = values.readings[sign][locale];
  const translation = values.translations[locale];
  const fieldClass = (path: string) => `${inputClass} ${err(path) ? "border-red-600" : ""}`;
  const fieldError = (path: string) => err(path) && <span className="text-red-700">{err(path)}</span>;
  const written = zodiacSigns.filter((s) => contentLocales.some((l) => hasWriting(values.readings[s][l])));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(values.status);
      }}
      className="space-y-5"
    >
      {result.error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-800">
          {result.error}{" "}
          {result.existingId && (
            <Link href={`/admin/horoscopes/${result.existingId}`} className="underline">
              Open the one already written
            </Link>
          )}
        </p>
      )}
      {(err("readings") || err("translations")) && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-800">{err("readings") || err("translations")}</p>
      )}
      {result.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Saved.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Kind
          <select
            value={values.period}
            onChange={(e) => {
              setValues((v) => ({ ...v, period: e.target.value as HoroscopeFormValues["period"] }));
              clearResult();
            }}
            className={inputClass}
          >
            {horoscopePeriods.map((p) => (
              <option key={p} value={p}>
                {periodNames[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          {values.period === "weekly"
            ? "Any day in the week"
            : values.period === "monthly"
              ? "Any day in the month"
              : values.period === "yearly"
                ? "Any day in the year"
                : "Date"}
          <input
            type="date"
            value={values.startsOn}
            onChange={(e) => {
              setValues((v) => ({ ...v, startsOn: e.target.value }));
              clearResult();
            }}
            className={fieldClass("startsOn")}
          />
          {fieldError("startsOn")}
        </label>
      </div>
      {values.period === "weekly" && <p className="-mt-3 text-xs text-charcoal/60">Weeks run Sunday to Saturday.</p>}

      <div>
        <p className="text-sm text-charcoal/70">Write in any languages you like. Visitors see their own language when it exists.</p>
        <div className="mt-2 flex gap-1 border-b border-gold/30">
          {contentLocales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`-mb-px rounded-t border px-3 py-2 text-sm ${
                locale === l ? "border-gold/30 border-b-warm-white bg-warm-white font-medium" : "border-transparent text-charcoal/70"
              }`}
            >
              {languageTabs[l]}
              {localeHasError(l) && <span className="ml-1 text-red-700">•</span>}
            </button>
          ))}
        </div>
      </div>

      <div lang={locale} className="space-y-4">
        <label className="block text-sm">
          {special ? "Title" : "Title (optional)"}
          <input
            value={translation.title}
            onChange={(e) => setTranslation("title", e.target.value)}
            maxLength={200}
            placeholder={values.period === "festival" ? "Maha Shivaratri 2027" : special ? "Mercury turns retrograde" : ""}
            className={fieldClass("translations")}
          />
        </label>
        <label className="block text-sm">
          A message for all signs (optional)
          <textarea value={translation.intro} onChange={(e) => setTranslation("intro", e.target.value)} rows={3} maxLength={5000} className={inputClass} />
        </label>
      </div>

      <fieldset className="rounded-xl border border-gold/30 p-3">
        <legend className="px-1 text-sm">
          Readings by sign <span className="text-charcoal/60">({written.length} of 12 written)</span>
        </legend>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {zodiacSigns.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSign(s)}
              aria-pressed={sign === s}
              className={`rounded-lg border px-1 py-1.5 text-center text-xs leading-tight ${
                sign === s ? "border-saffron bg-saffron text-white" : signHasError(s) ? "border-red-600" : "border-gold/40"
              }`}
            >
              <span className="block text-lg leading-none" aria-hidden>
                {signInfo[s].glyph}
              </span>
              {signNames[s]}
              {written.includes(s) && " ✓"}
            </button>
          ))}
        </div>

        <div lang={locale} className="mt-4 space-y-4">
          <p className="font-serif text-lg text-maroon">
            {signNames[sign]} <span className="text-sm text-charcoal/60">({signInfo[sign].western}) · {languageTabs[locale]}</span>
          </p>
          {readingFields.map((f) => {
            const path = `readings.${sign}.${locale}.${f}`;
            return (
              <label key={f} className="block text-sm">
                {fieldNames[f].label}
                {f === "lucky" ? (
                  <input value={reading[f]} onChange={(e) => setReading(f, e.target.value)} maxLength={300} placeholder={fieldNames[f].hint} className={fieldClass(path)} />
                ) : (
                  <textarea value={reading[f]} onChange={(e) => setReading(f, e.target.value)} rows={f === "overview" ? 4 : 2} className={fieldClass(path)} />
                )}
                {fieldError(path)}
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => setSign(zodiacSigns[(zodiacSigns.indexOf(sign) + 1) % 12])}
            className={secondaryButtonClass}
          >
            Next sign: {signNames[zodiacSigns[(zodiacSigns.indexOf(sign) + 1) % 12]]} →
          </button>
        </div>
      </fieldset>

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
