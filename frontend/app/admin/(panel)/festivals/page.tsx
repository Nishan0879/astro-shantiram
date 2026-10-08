import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { type FestivalKind, kindClass } from "@/lib/festivals";
import { primaryButtonClass } from "../../styles";
import BulkAdd from "./BulkAdd";
import { festivalKindNames } from "./names";

export const metadata: Metadata = { title: "Festival calendar" };

type AdminFestivalRow = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  kind: FestivalKind;
  status: "draft" | "published";
  locales: string[];
};

export default function FestivalsAdminPage({ searchParams }: PageProps<"/admin/festivals">) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Festival calendar</h1>
        <Link href="/admin/festivals/new" className={primaryButtonClass}>
          Add a day
        </Link>
      </div>
      <p className="mb-4 text-sm text-charcoal/70">
        Festivals, vrat days and special puja dates for the public calendar. Your events are added to it automatically.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Rows searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

async function Rows({ searchParams }: Pick<PageProps<"/admin/festivals">, "searchParams">) {
  const { year: requested, added } = await searchParams;
  const query = typeof requested === "string" && /^\d{4}$/.test(requested) ? `?year=${requested}` : "";
  const { year, today, festivals } = await adminJson<{ year: number; today: string; festivals: AdminFestivalRow[] }>(`/api/admin/festivals${query}`);

  return (
    <div className="space-y-4">
      {added && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Added.</p>}
      <BulkAdd />
      <div className="flex items-center justify-between gap-3">
        <Link href={`/admin/festivals?year=${year - 1}`} className="text-sm hover:text-saffron">
          ← {year - 1}
        </Link>
        <p className="font-serif text-xl text-maroon">{year}</p>
        <Link href={`/admin/festivals?year=${year + 1}`} className="text-sm hover:text-saffron">
          {year + 1} →
        </Link>
      </div>
      {festivals.length === 0 ? (
        <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
          Nothing in {year} yet. Tap “Add a day”, or paste a list above.
        </p>
      ) : (
        <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
          {festivals.map((f) => (
            <li key={f.id}>
              <Link href={`/admin/festivals/${f.id}`} className={`block p-4 hover:bg-cream ${(f.endDate ?? f.date) < today ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{f.name}</span>
                  {f.status === "draft" && <span className="shrink-0 rounded-full bg-charcoal/10 px-2 py-0.5 text-xs text-charcoal/70">Draft</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal/60">
                  <span>
                    {dateFormat.format(day(f.date))}
                    {f.endDate && ` – ${dateFormat.format(day(f.endDate))}`}
                    <span className={`ml-2 rounded-full px-2 py-0.5 ${kindClass[f.kind]}`}>{festivalKindNames[f.kind]}</span>
                  </span>
                  <span className="uppercase">{f.locales.join(" · ")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
