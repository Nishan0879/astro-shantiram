import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { addDays, type Appointment, wallClock } from "@/lib/booking";
import { statusClass, statusNames } from "../appointments/names";

export const metadata: Metadata = { title: "Calendar" };

type CalendarData = {
  from: string;
  to: string;
  today: string;
  appointments: Appointment[];
  blocked: { date: string; reason: string | null }[];
  windows: { weekday: number; startTime: string; endTime: string }[];
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const weekdayOf = (iso: string) => wallClock(iso).getUTCDay();
const startOfWeek = (iso: string) => addDays(iso, -weekdayOf(iso));
const format = (iso: string, options: Intl.DateTimeFormatOptions, time?: string) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(wallClock(iso, time));
const clock = (time: string) => format("2000-01-01", { hour: "numeric", minute: "2-digit" }, time);
const hours = (w: CalendarData["windows"][number]) => `${clock(w.startTime)} to ${clock(w.endTime)}`;

export default function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Calendar</h1>
        <Link href="/admin/appointments" className="text-sm text-saffron-dark underline">
          List of bookings
        </Link>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/admin/calendar">, "searchParams">) {
  const params = await searchParams;
  const view = params.view === "month" ? "month" : "week";
  const asked = typeof params.date === "string" && isoDate.test(params.date) ? params.date : undefined;

  // The month grid runs Sunday to Saturday for six weeks, so every month fits
  const anchor = asked ?? (await adminJson<CalendarData>("/api/admin/appointments/calendar?days=1")).today;
  const monthStart = `${anchor.slice(0, 8)}01`;
  const from = view === "month" ? startOfWeek(monthStart) : startOfWeek(anchor);
  const days = view === "month" ? 42 : 7;
  const data = await adminJson<CalendarData>(`/api/admin/appointments/calendar?from=${from}&days=${days}`);

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const byDate = Map.groupBy(data.appointments, (a) => a.date);
  const blocked = new Map(data.blocked.map((b) => [b.date, b.reason]));
  const windowsOn = (iso: string) => data.windows.filter((w) => w.weekday === weekdayOf(iso));

  const shift = (step: number) => {
    if (view === "week") return addDays(anchor, step * 7);
    const d = wallClock(monthStart);
    d.setUTCMonth(d.getUTCMonth() + step);
    return d.toISOString().slice(0, 10);
  };
  const href = (v: string, date: string) => `/admin/calendar?view=${v}&date=${date}`;
  const title =
    view === "month"
      ? format(monthStart, { month: "long", year: "numeric" })
      : `${format(dates[0], { month: "short", day: "numeric" })} to ${format(dates[6], { month: "short", day: "numeric", year: "numeric" })}`;
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 ${active ? "border-saffron bg-saffron text-white" : "border-gold/40 bg-white"}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={href("week", anchor)} className={pill(view === "week")}>
          Week
        </Link>
        <Link href={href("month", anchor)} className={pill(view === "month")}>
          Month
        </Link>
        <span className="mx-1 hidden sm:inline" />
        <Link href={href(view, shift(-1))} className={pill(false)} aria-label={`Previous ${view}`}>
          ‹ Back
        </Link>
        <Link href={href(view, data.today)} className={pill(false)}>
          Today
        </Link>
        <Link href={href(view, shift(1))} className={pill(false)} aria-label={`Next ${view}`}>
          Next ›
        </Link>
      </div>
      <h2 className="mb-3 font-medium">{title}</h2>

      {view === "week" ? (
        <div className="grid gap-3 lg:grid-cols-7">
          {dates.map((iso) => {
            const bookings = byDate.get(iso) ?? [];
            const open = windowsOn(iso);
            const dayOff = blocked.has(iso);
            return (
              <section
                key={iso}
                className={`rounded-xl border p-3 ${iso === data.today ? "border-saffron" : "border-gold/30"} ${dayOff ? "bg-charcoal/5" : "bg-warm-white"}`}
              >
                <h3 className="font-medium">
                  {format(iso, { weekday: "short", month: "short", day: "numeric" })}
                  {iso === data.today && <span className="ml-2 text-xs text-saffron-dark">Today</span>}
                </h3>
                <p className="mb-2 text-xs text-charcoal/60">
                  {dayOff ? `Day off${blocked.get(iso) ? `: ${blocked.get(iso)}` : ""}` : open.length ? open.map(hours).join(", ") : "No booking hours"}
                </p>
                {bookings.length === 0 ? (
                  <p className="text-sm text-charcoal/50">No bookings</p>
                ) : (
                  <ul className="space-y-2">
                    {bookings.map((a) => (
                      <li key={a.id}>
                        <Link href={`/admin/appointments/${a.id}`} className="block rounded-lg border border-gold/30 bg-white p-2 text-sm hover:border-saffron">
                          <span className="font-medium">{clock(a.startTime)}</span> {a.name}
                          <span className="block text-xs text-charcoal/60">{a.serviceName}</span>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusClass[a.status]}`}>{statusNames[a.status]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-gold/30 text-sm">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="border-b border-gold/30 bg-cream p-1 text-center text-xs font-medium">
              {d}
            </div>
          ))}
          {dates.map((iso) => {
            const bookings = byDate.get(iso) ?? [];
            const inMonth = iso.slice(0, 7) === monthStart.slice(0, 7);
            const waiting = bookings.some((a) => a.status === "requested");
            return (
              <Link
                key={iso}
                href={href("week", iso)}
                className={`min-h-16 border-b border-r border-gold/20 p-1 hover:bg-cream sm:min-h-24 ${blocked.has(iso) ? "bg-charcoal/5" : "bg-warm-white"} ${inMonth ? "" : "text-charcoal/40"}`}
              >
                <span className={`inline-block rounded-full px-1.5 ${iso === data.today ? "bg-saffron text-white" : ""}`}>
                  {Number(iso.slice(8))}
                </span>
                {blocked.has(iso) && <span className="block text-[10px] text-charcoal/60">Off</span>}
                {bookings.length > 0 && (
                  <>
                    {/* Phones show a count; wider screens list the first few */}
                    <span
                      className={`mt-1 block w-fit rounded-full px-1.5 text-xs sm:hidden ${waiting ? "bg-saffron text-white" : "bg-green-100 text-green-900"}`}
                    >
                      {bookings.length}
                    </span>
                    <ul className="mt-1 hidden space-y-0.5 sm:block">
                      {bookings.slice(0, 3).map((a) => (
                        <li key={a.id} className={`truncate rounded px-1 text-xs ${statusClass[a.status]}`}>
                          {clock(a.startTime)} {a.name}
                        </li>
                      ))}
                      {bookings.length > 3 && <li className="text-xs text-charcoal/60">+{bookings.length - 3} more</li>}
                    </ul>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-charcoal/60">
        Orange means waiting for you to confirm. Cancelled bookings are not shown. Times are US Central.
      </p>
    </>
  );
}
