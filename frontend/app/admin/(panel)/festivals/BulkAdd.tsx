"use client";

import { useState, useTransition } from "react";
import { contentLocales, type ContentLocale } from "@/lib/articles";
import { type FestivalKind, festivalKinds } from "@/lib/festivals";
import { addFestivalList, type BulkResult } from "../../festival-actions";
import { inputClass, secondaryButtonClass } from "../../styles";
import { festivalKindNames } from "./names";

const languageNames: Record<ContentLocale, string> = { en: "English", ne: "नेपाली", sa: "संस्कृतम्" };

/** Paste a year's Ekadashis (or any list) in one go instead of adding them one by one. */
export default function BulkAdd() {
  const [kind, setKind] = useState<FestivalKind>("ekadashi");
  const [locale, setLocale] = useState<ContentLocale>("en");
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult>({});
  const [pending, startTransition] = useTransition();

  return (
    <details className="rounded-xl border border-gold/30 bg-warm-white p-4">
      <summary className="cursor-pointer font-medium">Add many days at once</summary>
      <p className="mt-3 text-sm text-charcoal/70">
        Paste one day per line: the date, then the name. For example <code>11/1/2026 Haribodhini Ekadashi</code> or{" "}
        <code>2026-11-01 Haribodhini Ekadashi</code>. You can add other languages and descriptions later by tapping a day.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          These days are
          <select value={kind} onChange={(e) => setKind(e.target.value as FestivalKind)} className={inputClass}>
            {festivalKinds.map((k) => (
              <option key={k} value={k}>
                {festivalKindNames[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          The names are in
          <select value={locale} onChange={(e) => setLocale(e.target.value as ContentLocale)} className={inputClass}>
            {contentLocales.map((l) => (
              <option key={l} value={l}>
                {languageNames[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm">
        List
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult({});
          }}
          rows={8}
          placeholder={"11/1/2026 Haribodhini Ekadashi\n11/16/2026 Utpanna Ekadashi"}
          className={`${inputClass} font-mono text-sm`}
        />
      </label>
      {result.error && (
        <div className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          <p>{result.error}</p>
          {result.lines && (
            <ul className="mt-2 list-disc pl-5">
              {result.lines.map((l) => (
                <li key={l.line}>
                  Line {l.line} “{l.text}”: {l.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result.created && <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-900">Added {result.created} {result.created === 1 ? "day" : "days"}.</p>}
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() =>
          startTransition(async () => {
            const res = await addFestivalList(kind, locale, text);
            setResult(res);
            if (res.created) setText("");
          })
        }
        className={`mt-3 ${secondaryButtonClass}`}
      >
        {pending ? "Adding…" : "Add these days"}
      </button>
    </details>
  );
}
