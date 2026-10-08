import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminFetch } from "@/lib/admin-api";

export const metadata: Metadata = { title: "Visitors" };

type Stats = {
  from: string;
  today: string;
  totals: { views: number; visitors: number };
  days: { date: string; views: number; visitors: number }[];
  pages: { path: string; views: number }[];
  referrers: { host: string; visitors: number }[];
  devices: { device: "mobile" | "tablet" | "desktop"; visitors: number }[];
  locales: { locale: string; views: number }[];
};

const ranges = [7, 30, 90] as const;
const deviceNames = { mobile: "Phones", tablet: "Tablets", desktop: "Computers" };
const localeNames: Record<string, string> = { en: "English", ne: "Nepali", sa: "Sanskrit" };

const day = (iso: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

export default function VisitorsPage({ searchParams }: PageProps<"/admin/visitors">) {
  return (
    <>
      <h1 className="font-serif text-2xl text-maroon">Visitors</h1>
      <p className="mb-4 mt-1 text-sm text-charcoal/70">
        Who opens the website. Counted without cookies and without keeping anyone&apos;s address, so a person
        who comes back on another day counts again.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/admin/visitors">, "searchParams">) {
  const asked = Number((await searchParams).days);
  const days = ranges.find((r) => r === asked) ?? 30;
  const res = await adminFetch(`/api/admin/stats?days=${days}`);
  if (res.status === 403) return <p>Only Guruji and the main admin can see visitor numbers.</p>;
  if (!res.ok) throw new Error(`Loading visitor numbers failed: ${res.status}`);
  const stats = (await res.json()) as Stats;
  const peak = Math.max(1, ...stats.days.map((d) => d.views));
  const deviceTotal = stats.devices.reduce((sum, d) => sum + d.visitors, 0);
  const localeTotal = stats.locales.reduce((sum, l) => sum + l.views, 0);
  const share = (n: number, of: number) => `${Math.round((n / Math.max(1, of)) * 100)}%`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        {ranges.map((r) => (
          <Link
            key={r}
            href={`/admin/visitors?days=${r}`}
            className={`rounded-full border px-3 py-1 ${r === days ? "border-saffron bg-saffron/10 text-maroon" : "border-gold/30 hover:border-saffron"}`}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gold/30 bg-warm-white p-4">
          <div className="text-3xl font-semibold text-maroon">{stats.totals.visitors.toLocaleString("en-US")}</div>
          <div className="text-sm text-charcoal/70">Visits</div>
        </div>
        <div className="rounded-xl border border-gold/30 bg-warm-white p-4">
          <div className="text-3xl font-semibold text-maroon">{stats.totals.views.toLocaleString("en-US")}</div>
          <div className="text-sm text-charcoal/70">Pages opened</div>
        </div>
      </div>

      <section className="rounded-xl border border-gold/30 bg-warm-white p-4">
        <h2 className="mb-3 font-medium">
          Pages opened each day, {day(stats.from)} to {day(stats.today)}
        </h2>
        <div className="flex h-36 items-end gap-px" role="img" aria-label="Pages opened each day">
          {stats.days.map((d) => (
            <div
              key={d.date}
              title={`${day(d.date, { weekday: "short", month: "short", day: "numeric" })}: ${d.visitors} visits, ${d.views} pages`}
              className="flex-1 rounded-t bg-saffron/80 hover:bg-maroon"
              style={{ height: `${Math.max(d.views ? 3 : 1, (d.views / peak) * 100)}%`, opacity: d.views ? 1 : 0.25 }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-charcoal/60">
          <span>{day(stats.from)}</span>
          <span>Busiest day: {peak.toLocaleString("en-US")} pages</span>
          <span>Today</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <List title="Most opened pages" empty="No pages opened yet." rows={stats.pages.map((p) => [p.path, p.views])} />
        <List
          title="Where visitors came from"
          empty="Everyone typed the address or used a bookmark."
          rows={stats.referrers.map((r) => [r.host, r.visitors])}
        />
        <List
          title="Devices"
          empty="No visits yet."
          rows={stats.devices
            .toSorted((a, b) => b.visitors - a.visitors)
            .map((d) => [deviceNames[d.device], share(d.visitors, deviceTotal)])}
        />
        <List
          title="Language of the pages"
          empty="No visits yet."
          rows={stats.locales
            .toSorted((a, b) => b.views - a.views)
            .map((l) => [localeNames[l.locale] ?? l.locale, share(l.views, localeTotal)])}
        />
      </div>
    </div>
  );
}

function List({ title, empty, rows }: { title: string; empty: string; rows: [string, number | string][] }) {
  return (
    <section className="rounded-xl border border-gold/30 bg-warm-white p-4">
      <h2 className="mb-2 font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-charcoal/60">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map(([label, value]) => (
            <li key={label} className="flex justify-between gap-3">
              <span className="truncate">{label}</span>
              <span className="shrink-0 tabular-nums text-charcoal/70">{typeof value === "number" ? value.toLocaleString("en-US") : value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
