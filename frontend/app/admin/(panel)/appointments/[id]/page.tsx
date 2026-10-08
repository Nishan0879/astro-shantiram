import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminFetch, formatDate } from "@/lib/admin-api";
import type { Appointment } from "@/lib/booking";
import { formatPrice } from "@/lib/services";
import { todayInSiteZone } from "@/lib/site";
import { serviceModeNames } from "../../services/names";
import { languageNames, statusClass, statusNames, whenLabel } from "../names";
import AppointmentActions from "./AppointmentActions";

export const metadata: Metadata = { title: "Appointment" };

export default function AppointmentPage({ params }: PageProps<"/admin/appointments/[id]">) {
  return (
    <>
      <Link href="/admin/appointments" className="text-sm hover:text-saffron">
        ← All appointments
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Details params={params} />
      </Suspense>
    </>
  );
}

async function Details({ params }: Pick<PageProps<"/admin/appointments/[id]">, "params">) {
  const { id } = await params;
  const res = await adminFetch(`/api/admin/appointments/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading appointment failed: ${res.status}`);
  const { appointment: a, manageUrl } = (await res.json()) as { appointment: Appointment; manageUrl: string | null };

  const rows: [string, string | null][] = [
    ["Kind", a.kind === "puja" ? "Puja request (the time is their preference)" : "Consultation"],
    ["How", serviceModeNames[a.mode]],
    ["Language", languageNames[a.language]],
    ["Length", `About ${a.durationMinutes} minutes`],
    ["Price", a.priceCents === null ? null : formatPrice(a.priceCents, "en")],
    ["Address", a.address],
    ["Gotra", a.gotra],
    ["Family names", a.familyNames],
    ["Their notes", a.notes],
    ["Booked", formatDate(a.createdAt)],
    ["Reminder email", a.reminderSentAt ? `Sent ${formatDate(a.reminderSentAt)}` : null],
  ];

  return (
    <>
      <div className="mb-4 mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl text-maroon">{whenLabel(a.date, a.startTime)}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[a.status]}`}>{statusNames[a.status]}</span>
        </div>
        <p className="mt-1">
          {a.serviceName} · <span className="font-mono text-sm">{a.reference}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
            <h2 className="font-medium">{a.name}</h2>
            <p className="mt-2 text-sm">
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="text-saffron-dark underline">
                {a.phone}
              </a>
            </p>
            <p className="mt-1 break-all text-sm">
              <a href={`mailto:${a.email}?subject=${encodeURIComponent(`Your booking ${a.reference}`)}`} className="text-saffron-dark underline">
                {a.email}
              </a>
            </p>
            {manageUrl && (
              <p className="mt-3 text-xs text-charcoal/70">
                Their link to move or cancel it (it is in their emails):{" "}
                <a href={manageUrl} className="break-all text-saffron-dark underline">
                  {manageUrl}
                </a>
              </p>
            )}
          </section>
          <dl className="space-y-3 rounded-xl border border-gold/30 bg-warm-white p-5 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-charcoal/60">{label}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
        <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
          <AppointmentActions appointment={a} isPast={a.date <= todayInSiteZone()} />
        </section>
      </div>
    </>
  );
}
