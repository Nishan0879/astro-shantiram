import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { SettingsValues, WindowValues } from "@/app/admin/appointment-actions";
import { adminJson } from "@/lib/admin-api";
import { todayInSiteZone } from "@/lib/site";
import { BookingRules, DaysOff, WeeklyHours } from "./ScheduleEditor";

export const metadata: Metadata = { title: "Schedule" };

type Schedule = { settings: SettingsValues; windows: WindowValues[]; blocked: { date: string; reason: string | null }[] };

export default function SchedulePage() {
  return (
    <>
      <Link href="/admin/appointments" className="text-sm hover:text-saffron">
        ← Appointments
      </Link>
      <h1 className="mb-1 mt-2 font-serif text-2xl text-maroon">Schedule</h1>
      <p className="mb-6 text-sm text-charcoal/70">
        Consultations can be booked in these hours (US Central). Pujas are requests for any open day, which you confirm yourself.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Editors />
      </Suspense>
    </>
  );
}

async function Editors() {
  const { settings, windows, blocked } = await adminJson<Schedule>("/api/admin/schedule");
  const { slotStepMinutes, defaultDurationMinutes, bufferMinutes, maxPerDay, minNoticeHours, maxDaysAhead } = settings;
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <h2 className="mb-3 font-serif text-xl text-maroon">Weekly hours</h2>
        <WeeklyHours initial={windows} />
      </section>
      <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <h2 className="mb-3 font-serif text-xl text-maroon">Days off</h2>
        <DaysOff blocked={blocked} today={todayInSiteZone()} />
      </section>
      <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <h2 className="mb-3 font-serif text-xl text-maroon">Booking rules</h2>
        <BookingRules initial={{ slotStepMinutes, defaultDurationMinutes, bufferMinutes, maxPerDay, minNoticeHours, maxDaysAhead }} />
      </section>
    </div>
  );
}
