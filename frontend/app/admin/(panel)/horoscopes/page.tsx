import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { type HoroscopePeriod, spanLabel } from "@/lib/horoscopes";
import { primaryButtonClass } from "../../styles";
import { periodNames } from "./names";

export const metadata: Metadata = { title: "Horoscopes" };

type AdminEditionRow = {
  id: string;
  period: HoroscopePeriod;
  startsOn: string;
  status: "draft" | "published";
  title: string | null;
  signs: number;
};

export default function HoroscopesAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Horoscopes</h1>
        <Link href="/admin/horoscopes/new" className={primaryButtonClass}>
          Write a horoscope
        </Link>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <EditionRows />
      </Suspense>
    </>
  );
}

async function EditionRows() {
  const { editions } = await adminJson<{ editions: AdminEditionRow[] }>("/api/admin/horoscopes");
  if (editions.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
        No horoscopes yet. Tap “Write a horoscope” to write today’s.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {editions.map((e) => (
        <li key={e.id}>
          <Link href={`/admin/horoscopes/${e.id}`} className="block p-4 hover:bg-cream">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">
                {periodNames[e.period]} · {e.title ?? spanLabel(e.period, e.startsOn, "en-US")}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  e.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                }`}
              >
                {e.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <div className="mt-1 text-xs text-charcoal/60">
              {e.title && `${spanLabel(e.period, e.startsOn, "en-US")} · `}
              {e.signs} of 12 signs written
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
