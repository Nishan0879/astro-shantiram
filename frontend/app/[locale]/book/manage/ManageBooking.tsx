"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { type Availability, type CustomerBooking, googleCalendarUrl, wallClock } from "@/lib/booking";
import SlotPicker from "../SlotPicker";
import { cancelBooking, loadMoveTimes, type ManageResult, moveBooking } from "./actions";

type Panel = "none" | "move" | "cancel";
type Done = "moved" | "cancelled" | null;

export default function ManageBooking({ initial, manageKey, pageUrl }: { initial: CustomerBooking; manageKey: string; pageUrl: string }) {
  const t = useTranslations("ManageBooking");
  const s = useTranslations("Services");
  const locale = useLocale();
  const [booking, setBooking] = useState(initial);
  const [panel, setPanel] = useState<Panel>("none");
  const [times, setTimes] = useState<Availability | null>(null);
  const [pick, setPick] = useState({ date: "", time: "" });
  const [problem, setProblem] = useState<"taken" | "too_late" | "failed" | "noTimes" | null>(null);
  const [done, setDone] = useState<Done>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const isPuja = booking.kind === "puja";
  const active = booking.status === "requested" || booking.status === "confirmed" || booking.status === "rescheduled";
  const timeFormat = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { dateStyle: "full", timeZone: "UTC" });
  const when = (date: string, time: string) => `${longDate.format(wallClock(date))}, ${timeFormat.format(wallClock(date, time))}`;
  const query = new URLSearchParams({ ref: booking.reference, key: manageKey });

  function openPanel(next: Panel) {
    setPanel(next);
    setProblem(null);
    setDone(null);
    if (next === "move" && !times) showWeeks();
  }

  function showWeeks(from?: string) {
    startLoading(async () => {
      const next = await loadMoveTimes(booking.reference, manageKey, from);
      if (next) setTimes(next);
      else setProblem("noTimes");
    });
  }

  function finish(res: ManageResult, outcome: Done) {
    if (res.ok) {
      setBooking(res.booking);
      setPanel("none");
      setTimes(null);
      setPick({ date: "", time: "" });
      setDone(outcome);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setProblem(res.error);
    if (res.error === "taken") {
      setPick((p) => ({ ...p, time: isPuja ? p.time : "" }));
      showWeeks(times?.days[0].date);
    }
  }

  const rows: [string, string | null][] = [
    [t("reference"), booking.reference],
    [isPuja ? t("whenPuja") : t("when"), `${when(booking.date, booking.time)} · ${t("central")}`],
    [t("length"), t("minutes", { count: booking.durationMinutes })],
    [t("how"), s(`modes.${booking.mode}`)],
    [t("address"), booking.mode === "home_visit" ? booking.address : null],
  ];

  return (
    <div className="mt-8 space-y-8">
      {done && (
        <p className="rounded-xl border border-green-700/30 bg-green-50 p-4 text-green-900" role="status">
          {done === "cancelled" ? t("cancelledDone") : booking.status === "requested" ? t("movedDoneRequest") : t("movedDone", { when: when(booking.date, booking.time) })}
        </p>
      )}

      <section className="rounded-xl border border-gold/30 bg-cream p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-serif text-2xl text-maroon">{booking.serviceName}</h2>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              booking.status === "cancelled" || booking.status === "no_show"
                ? "bg-red-100 text-red-800"
                : booking.status === "requested"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-green-100 text-green-900"
            }`}
          >
            {t(`status.${booking.status}`)}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-charcoal/60">{label}</dt>
                {/* Browsers without Nepali or Sanskrit date names write the date differently from the server */}
                <dd className={label === t("reference") ? "font-mono tracking-wider" : ""} suppressHydrationWarning>
                  {value}
                </dd>
              </div>
            ))}
        </dl>
        {active && booking.meetingLink && (
          <a
            href={booking.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark"
          >
            {t("join")}
          </a>
        )}
      </section>

      {active && (
        <section aria-labelledby="add-calendar">
          <h2 id="add-calendar" className="font-serif text-xl text-maroon">
            {t("addToCalendar")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/booking-calendar?${query}`} className="rounded-full border border-saffron/60 bg-warm-white px-4 py-2 text-sm hover:bg-saffron/10">
              {t("calendarFile")}
            </a>
            <a
              href={googleCalendarUrl(booking, pageUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-saffron/60 bg-warm-white px-4 py-2 text-sm hover:bg-saffron/10"
            >
              {t("googleCalendar")}
            </a>
          </div>
        </section>
      )}

      {active && !booking.canChange && <p className="rounded bg-amber-50 p-4 text-amber-900">{t("tooLate")}</p>}

      {active && booking.canChange && (
        <section aria-labelledby="change-booking" className="space-y-6">
          <h2 id="change-booking" className="font-serif text-xl text-maroon">
            {t("changeTitle")}
          </h2>
          {panel === "none" && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => openPanel("move")} className="rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark">
                {t("move")}
              </button>
              <button type="button" onClick={() => openPanel("cancel")} className="rounded-full border border-red-700/50 px-5 py-2 text-red-800 hover:bg-red-50">
                {t("cancel")}
              </button>
            </div>
          )}

          {panel === "cancel" && (
            <div className="rounded-xl border border-red-700/30 bg-red-50 p-5">
              <p className="font-medium">{t("cancelAsk", { when: when(booking.date, booking.time) })}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => startSaving(async () => finish(await cancelBooking(booking.reference, manageKey), "cancelled"))}
                  className="rounded-full bg-red-700 px-5 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {saving ? t("cancelling") : t("cancelYes")}
                </button>
                <button type="button" disabled={saving} onClick={() => openPanel("none")} className="rounded-full border border-charcoal/30 px-5 py-2 hover:bg-white">
                  {t("cancelNo")}
                </button>
              </div>
            </div>
          )}

          {panel === "move" && (
            <div className="space-y-8">
              <p className="text-sm text-charcoal/80">{isPuja ? t("moveNotePuja") : t("moveNote")}</p>
              {times ? (
                <SlotPicker
                  availability={times}
                  date={pick.date}
                  time={pick.time}
                  loading={loading}
                  onDate={(date) => {
                    setPick((p) => ({ date, time: isPuja ? p.time : "" }));
                    setProblem(null);
                  }}
                  onTime={(time) => {
                    setPick((p) => ({ ...p, time }));
                    setProblem(null);
                  }}
                  onShowWeeks={showWeeks}
                  titles={{ date: t("moveDateTitle"), time: isPuja ? t("moveTimeTitlePuja") : t("moveTimeTitle") }}
                />
              ) : (
                loading && <div className="h-64 animate-pulse rounded-xl bg-cream" />
              )}
              <div className="flex flex-wrap gap-3">
                {pick.date && pick.time && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => startSaving(async () => finish(await moveBooking(booking.reference, manageKey, pick.date, pick.time), "moved"))}
                    className="rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark disabled:opacity-60"
                  >
                    {saving ? t("moving") : t("moveConfirm", { when: when(pick.date, pick.time) })}
                  </button>
                )}
                <button type="button" disabled={saving} onClick={() => openPanel("none")} className="rounded-full border border-charcoal/30 px-5 py-2 hover:bg-white">
                  {t("keepTime")}
                </button>
              </div>
            </div>
          )}

          {problem && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
              {t(`problems.${problem}`)}
            </p>
          )}
        </section>
      )}

      {!active && (
        <Link href="/book" className="inline-block rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
          {t("bookAgain")}
        </Link>
      )}
    </div>
  );
}
