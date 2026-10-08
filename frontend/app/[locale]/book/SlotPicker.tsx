"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { addDays, type Availability, wallClock } from "@/lib/booking";

const inputClass = "mt-1 w-full rounded border border-gold/40 bg-warm-white px-3 py-2 focus:border-saffron focus:outline-none";

/** The month of open days and the times on the chosen one, for booking and for moving a booking. */
export default function SlotPicker({
  availability,
  date,
  time,
  loading,
  onDate,
  onTime,
  onShowWeeks,
  dateError,
  timeError,
  timeInvalid = false,
  titles,
}: {
  availability: Availability;
  date: string;
  time: string;
  loading: boolean;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  onShowWeeks: (from: string) => void;
  dateError?: ReactNode;
  timeError?: ReactNode;
  timeInvalid?: boolean;
  titles?: { date: string; time: string };
}) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const isPuja = availability.kind === "puja";
  const day = availability.days.find((d) => d.date === date);

  const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const timeFormat = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { dateStyle: "full", timeZone: "UTC" });

  const firstWeekday = wallClock(availability.days[0].date).getUTCDay();
  const canGoBack = availability.days[0].date > availability.earliest;
  const lastShown = availability.days.at(-1)!.date;

  return (
    <>
      <section aria-labelledby="pick-date">
        <h2 id="pick-date" className="font-serif text-2xl text-maroon">
          {titles?.date ?? t("stepDate")}
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
            const chosen = d.date === date;
            const first = d.date.endsWith("-01") || d.date === availability.days[0].date;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!d.open}
                onClick={() => onDate(d.date)}
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
                {first && (
                  <span className="absolute inset-x-0 top-0.5 text-[10px] leading-none opacity-70">
                    {new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(wallClock(d.date))}
                  </span>
                )}
                {dayFormat.format(wallClock(d.date))}
              </button>
            );
          })}
        </div>
        {!availability.days.some((d) => d.open) && <p className="mt-3 text-sm text-charcoal/70">{t("noDays")}</p>}
        <div className="mt-3 flex justify-between text-sm">
          {canGoBack ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onShowWeeks(addDays(availability.days[0].date, -35))}
              className="text-saffron-dark hover:underline"
            >
              ← {t("earlierDates")}
            </button>
          ) : (
            <span />
          )}
          {lastShown < availability.lastDate && (
            <button type="button" disabled={loading} onClick={() => onShowWeeks(addDays(lastShown, 1))} className="text-saffron-dark hover:underline">
              {t("laterDates")} →
            </button>
          )}
        </div>
        {dateError}
      </section>

      {date && (
        <section aria-labelledby="pick-time">
          <h2 id="pick-time" className="font-serif text-2xl text-maroon">
            {titles?.time ?? t(isPuja ? "stepTimePuja" : "stepTime")}
          </h2>
          <p className="mt-1 text-sm text-charcoal/70">
            {longDate.format(wallClock(date))} · {t("timeZone")}
          </p>
          {isPuja ? (
            <label className="mt-3 block max-w-xs">
              <span className="sr-only">{t("stepTimePuja")}</span>
              <input
                type="time"
                value={time}
                onChange={(e) => onTime(e.target.value)}
                step={900}
                className={`${inputClass} ${timeInvalid ? "border-red-600" : ""}`}
              />
            </label>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(day?.slots ?? []).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={time === slot}
                  onClick={() => onTime(slot)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    time === slot ? "border-saffron bg-saffron text-white" : "border-saffron/50 bg-warm-white hover:bg-saffron/10"
                  }`}
                >
                  {timeFormat.format(wallClock(date, slot))}
                </button>
              ))}
            </div>
          )}
          {timeError}
        </section>
      )}
    </>
  );
}
