import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { eventDay, timeRange } from "@/lib/events";
import { primaryButtonClass } from "../../styles";

export const metadata: Metadata = { title: "Events" };

type AdminEventRow = {
  id: string;
  name: string;
  status: "draft" | "published";
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  locales: string[];
};

export default function EventsAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Events</h1>
        <Link href="/admin/events/new" className={primaryButtonClass}>
          New event
        </Link>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <EventRows />
      </Suspense>
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function EventRows() {
  const { events } = await adminJson<{ events: AdminEventRow[] }>("/api/admin/events");
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
        No events yet. Tap “New event” to add the first one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {events.map((e) => {
        const time = timeRange(e.startTime?.slice(0, 5) ?? null, e.endTime?.slice(0, 5) ?? null);
        return (
          <li key={e.id}>
            <Link href={`/admin/events/${e.id}`} className="block p-4 hover:bg-cream">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{e.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    e.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                  }`}
                >
                  {e.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-xs text-charcoal/60">
                <span>
                  {dateFormat.format(eventDay(e.eventDate))}
                  {time && ` · ${time}`}
                </span>
                <span className="uppercase">{e.locales.join(" · ")}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
