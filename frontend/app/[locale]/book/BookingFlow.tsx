"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addDays, appointmentLanguages, type AppointmentLanguage, type Availability, wallClock } from "@/lib/booking";
import type { ServiceSummary } from "@/lib/services";
import { type BookingResult, type BookingValues, loadAvailability, requestBooking } from "./actions";

const inputClass = "mt-1 w-full rounded border border-gold/40 bg-warm-white px-3 py-2 focus:border-saffron focus:outline-none";
type Field = "name" | "email" | "phone" | "address" | "time" | "mode" | "date";

export default function BookingFlow({ service, initial }: { service: ServiceSummary; initial: Availability }) {
  const t = useTranslations("Booking");
  const s = useTranslations("Services");
  const locale = useLocale();
  const [availability, setAvailability] = useState(initial);
  const [values, setValues] = useState<BookingValues>({
    service: service.slug,
    date: "",
    time: "",
    mode: service.modes.length === 1 ? service.modes[0] : "",
    language: (appointmentLanguages as readonly string[]).includes(locale) ? (locale as AppointmentLanguage) : "en",
    name: "",
    email: "",
    phone: "",
    address: "",
    gotra: "",
    familyNames: "",
    notes: "",
  });
  const [result, setResult] = useState<BookingResult | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  const isPuja = availability.kind === "puja";
  const day = availability.days.find((d) => d.date === values.date);
  const set = <K extends keyof BookingValues>(key: K, value: BookingValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r && !r.ok && r.error !== "fix" ? null : r));
  };

  const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const timeFormat = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { dateStyle: "full", timeZone: "UTC" });

  function showWeeks(from: string) {
    startLoading(async () => {
      const next = await loadAvailability(service.slug, from);
      if (next) setAvailability(next);
    });
  }

  function pickDate(date: string) {
    setValues((v) => ({ ...v, date, time: isPuja ? v.time : "" }));
    setResult(null);
  }

  function submit() {
    startSending(async () => {
      const res = await requestBooking(values);
      setResult(res);
      if (!res.ok && res.error === "taken") {
        setValues((v) => ({ ...v, time: isPuja ? v.time : "" }));
        const fresh = await loadAvailability(service.slug, availability.days[0].date);
        if (fresh) setAvailability(fresh);
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="mt-8 rounded-xl border border-gold/30 bg-cream p-6" role="status">
        <h2 className="font-serif text-2xl text-maroon">{t("doneTitle", { name: values.name })}</h2>
        <p className="mt-3 leading-relaxed">
          {t(isPuja ? "doneTextPuja" : "doneText", {
            service: service.name,
            when: `${longDate.format(wallClock(result.date))}, ${timeFormat.format(wallClock(result.date, result.time))}`,
          })}
        </p>
        <p className="mt-4 text-lg">
          {t("reference")} <strong className="font-mono tracking-wider">{result.reference}</strong>
        </p>
        <p className="mt-2 text-sm text-charcoal/70">{t("doneEmail", { email: values.email })}</p>
      </div>
    );
  }

  const firstWeekday = wallClock(availability.days[0].date).getUTCDay();
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const invalid = (f: string) => (fieldErrors[f] ? "border-red-600" : "");
  const errorText = (f: Field) =>
    fieldErrors[f] ? <span className="mt-1 block text-sm text-red-700">{t(`errors.${f}`)}</span> : null;
  const canGoBack = availability.days[0].date > availability.earliest;
  const lastShown = availability.days.at(-1)!.date;

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="pick-date">
        <h2 id="pick-date" className="font-serif text-2xl text-maroon">
          {t("stepDate")}
        </h2>
        {isPuja && <p className="mt-2 text-sm text-charcoal/80">{t("pujaNote")}</p>}
        <p className="mt-3 font-medium">
          {monthFormat.format(wallClock(availability.days[0].date))}
          {monthFormat.format(wallClock(availability.days[0].date)) !== monthFormat.format(wallClock(lastShown)) &&
            ` – ${monthFormat.format(wallClock(lastShown))}`}
        </p>
        <div className={`mt-3 grid grid-cols-7 gap-1 text-center ${loading ? "opacity-50" : ""}`}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="pb-1 text-xs text-charcoal/60">
              {weekdayFormat.format(wallClock(addDays("2026-10-04", i)))}
            </div>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {availability.days.map((d) => {
            const chosen = d.date === values.date;
            const first = d.date.endsWith("-01") || d.date === availability.days[0].date;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!d.open}
                onClick={() => pickDate(d.date)}
                aria-pressed={chosen}
                aria-label={longDate.format(wallClock(d.date))}
                className={`relative aspect-square rounded-lg text-sm ${
                  chosen
                    ? "bg-saffron font-semibold text-white"
                    : d.open
                      ? "border border-saffron/50 bg-warm-white font-medium hover:bg-saffron/10"
                      : "text-charcoal/30"
                }`}
              >
                {first && <span className="absolute inset-x-0 top-0.5 text-[10px] leading-none opacity-70">{new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(wallClock(d.date))}</span>}
                {dayFormat.format(wallClock(d.date))}
              </button>
            );
          })}
        </div>
        {!availability.days.some((d) => d.open) && <p className="mt-3 text-sm text-charcoal/70">{t("noDays")}</p>}
        <div className="mt-3 flex justify-between text-sm">
          {canGoBack ? (
            <button type="button" disabled={loading} onClick={() => showWeeks(addDays(availability.days[0].date, -35))} className="text-saffron-dark hover:underline">
              ← {t("earlierDates")}
            </button>
          ) : (
            <span />
          )}
          {lastShown < availability.lastDate && (
            <button type="button" disabled={loading} onClick={() => showWeeks(addDays(lastShown, 1))} className="text-saffron-dark hover:underline">
              {t("laterDates")} →
            </button>
          )}
        </div>
        {errorText("date")}
      </section>

      {values.date && (
        <section aria-labelledby="pick-time">
          <h2 id="pick-time" className="font-serif text-2xl text-maroon">
            {t(isPuja ? "stepTimePuja" : "stepTime")}
          </h2>
          <p className="mt-1 text-sm text-charcoal/70">
            {longDate.format(wallClock(values.date))} · {t("timeZone")}
          </p>
          {isPuja ? (
            <label className="mt-3 block max-w-xs">
              <span className="sr-only">{t("stepTimePuja")}</span>
              <input type="time" value={values.time} onChange={(e) => set("time", e.target.value)} step={900} className={`${inputClass} ${invalid("time")}`} />
            </label>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(day?.slots ?? []).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={values.time === slot}
                  onClick={() => set("time", slot)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    values.time === slot ? "border-saffron bg-saffron text-white" : "border-saffron/50 bg-warm-white hover:bg-saffron/10"
                  }`}
                >
                  {timeFormat.format(wallClock(values.date, slot))}
                </button>
              ))}
            </div>
          )}
          {errorText("time")}
        </section>
      )}

      {values.date && values.time && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
          aria-labelledby="your-details"
        >
          <h2 id="your-details" className="font-serif text-2xl text-maroon">
            {t("stepDetails")}
          </h2>
          {service.modes.length > 0 && (
            <fieldset>
              <legend>{t("mode")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {service.modes.map((m) => (
                  <label
                    key={m}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                      values.mode === m ? "border-saffron bg-saffron text-white" : `border-saffron/50 bg-warm-white ${invalid("mode")}`
                    }`}
                  >
                    <input type="radio" name="mode" value={m} checked={values.mode === m} onChange={() => set("mode", m)} className="sr-only" />
                    {s(`modes.${m}`)}
                  </label>
                ))}
              </div>
              {errorText("mode")}
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              {t("name")}
              <input value={values.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} autoComplete="name" className={`${inputClass} ${invalid("name")}`} />
              {errorText("name")}
            </label>
            <label className="block">
              {t("language")}
              <select value={values.language} onChange={(e) => set("language", e.target.value as AppointmentLanguage)} className={inputClass}>
                {appointmentLanguages.map((l) => (
                  <option key={l} value={l}>
                    {t(`languages.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t("email")}
              <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" className={`${inputClass} ${invalid("email")}`} />
              {errorText("email")}
            </label>
            <label className="block">
              {t("phone")}
              <input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} required autoComplete="tel" className={`${inputClass} ${invalid("phone")}`} />
              {errorText("phone")}
            </label>
          </div>
          {(isPuja || values.mode === "home_visit" || values.mode === "in_person") && (
            <label className="block">
              {values.mode === "home_visit" ? t("address") : t("addressOptional")}
              <span className="block text-sm text-charcoal/60">{t(values.mode === "home_visit" ? "addressHint" : "addressHintOptional")}</span>
              <input
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                required={values.mode === "home_visit"}
                maxLength={300}
                autoComplete="street-address"
                className={`${inputClass} ${invalid("address")}`}
              />
              {errorText("address")}
            </label>
          )}
          {isPuja && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                {t("gotra")}
                <input value={values.gotra} onChange={(e) => set("gotra", e.target.value)} maxLength={100} className={inputClass} />
              </label>
              <label className="block">
                {t("familyNames")}
                <span className="block text-sm text-charcoal/60">{t("familyHint")}</span>
                <textarea value={values.familyNames} onChange={(e) => set("familyNames", e.target.value)} rows={2} maxLength={2000} className={inputClass} />
              </label>
            </div>
          )}
          <label className="block">
            {t("notes")}
            <textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={4} maxLength={3000} className={inputClass} />
          </label>

          {result && !result.ok && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
              {t(`problems.${result.error}`)}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark disabled:opacity-60"
          >
            {sending ? t("sending") : t(isPuja ? "submitPuja" : "submit")}
          </button>
          <p className="text-sm text-charcoal/70">{t(isPuja ? "afterPuja" : "after")}</p>
        </form>
      )}
    </div>
  );
}
