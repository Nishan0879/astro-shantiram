"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { appointmentLanguages, type AppointmentLanguage, type Availability, wallClock } from "@/lib/booking";
import type { ServiceSummary } from "@/lib/services";
import { phoneInputProps, tenDigits } from "@/lib/phone";
import { Link } from "@/i18n/navigation";
import SlotPicker from "./SlotPicker";
import SpamTrap, { spamTrapValues } from "@/components/SpamTrap";
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
  const set = <K extends keyof BookingValues>(key: K, value: BookingValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult((r) => (r && !r.ok && r.error !== "fix" ? null : r));
  };

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

  function submit(form: HTMLFormElement) {
    const trap = spamTrapValues(form);
    startSending(async () => {
      const res = await requestBooking(values, trap);
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
        {result.manageKey && (
          <Link
            href={`/book/manage?${new URLSearchParams({ ref: result.reference, key: result.manageKey })}`}
            className="mt-5 inline-block rounded-full border border-saffron/60 bg-warm-white px-5 py-2 text-sm hover:bg-saffron/10"
          >
            {t("manage")}
          </Link>
        )}
      </div>
    );
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const invalid = (f: string) => (fieldErrors[f] ? "border-red-600" : "");
  const errorText = (f: Field) =>
    fieldErrors[f] ? <span className="mt-1 block text-sm text-red-700">{t(`errors.${f}`)}</span> : null;

  return (
    <div className="mt-8 space-y-10">
      <SlotPicker
        availability={availability}
        date={values.date}
        time={values.time}
        loading={loading}
        onDate={pickDate}
        onTime={(time) => set("time", time)}
        onShowWeeks={showWeeks}
        dateError={errorText("date")}
        timeError={errorText("time")}
        timeInvalid={Boolean(fieldErrors.time)}
      />

      {values.date && values.time && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="relative space-y-4"
          aria-labelledby="your-details"
        >
          <SpamTrap />
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
              <input {...phoneInputProps} value={values.phone} onChange={(e) => set("phone", tenDigits(e.target.value))} required className={`${inputClass} ${invalid("phone")}`} />
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
