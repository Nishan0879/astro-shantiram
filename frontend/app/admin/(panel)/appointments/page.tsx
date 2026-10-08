import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import type { Appointment } from "@/lib/booking";
import { serviceModeNames } from "../services/names";
import { statusClass, statusNames, whenLabel } from "./names";

export const metadata: Metadata = { title: "Appointments" };

const views = [
  { value: "requests", label: "Waiting for you" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type AppointmentList = { view: string; today: string; appointments: Appointment[]; counts: { requests: number; today: number } };

export default function AppointmentsPage({ searchParams }: PageProps<"/admin/appointments">) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Appointments</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/calendar" className="text-saffron-dark underline">
            Calendar
          </Link>
          <Link href="/admin/schedule" className="text-saffron-dark underline">
            Weekly hours and days off
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Appointments searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Appointments({ searchParams }: Pick<PageProps<"/admin/appointments">, "searchParams">) {
  const params = await searchParams;
  const view = views.find((v) => v.value === params.view)?.value ?? "requests";
  const { appointments, counts, today } = await adminJson<AppointmentList>(`/api/admin/appointments?view=${view}`);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {views.map((v) => (
          <Link
            key={v.value}
            href={`/admin/appointments?view=${v.value}`}
            className={`rounded-full border px-3 py-1 ${v.value === view ? "border-saffron bg-saffron text-white" : "border-gold/40 bg-white"}`}
          >
            {v.label}
            {v.value === "requests" && ` (${counts.requests})`}
          </Link>
        ))}
      </div>
      {counts.today > 0 && (
        <p className="mb-4 text-sm text-charcoal/70">
          {counts.today} {counts.today === 1 ? "booking" : "bookings"} today.
        </p>
      )}

      {appointments.length === 0 ? (
        <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
          {view === "requests" ? "No new requests. New bookings from the website show up here." : "Nothing here."}
        </p>
      ) : (
        <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
          {appointments.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/appointments/${a.id}`} className="block p-4 hover:bg-cream">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    {a.date === today && <span className="text-saffron-dark">Today · </span>}
                    {whenLabel(a.date, a.startTime)}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass[a.status]}`}>{statusNames[a.status]}</span>
                </div>
                <div className="mt-1 text-sm">
                  {a.name} · {a.serviceName}
                </div>
                <div className="mt-0.5 text-xs text-charcoal/60">
                  {a.kind === "puja" ? "Puja request (preferred time)" : "Consultation"} · {serviceModeNames[a.mode]}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
