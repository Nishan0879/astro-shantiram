import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteHoroscope } from "@/app/admin/horoscope-actions";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import { type HoroscopePeriod, readingFields, zodiacSigns } from "@/lib/horoscopes";
import { emptyHoroscope } from "../empty";
import HoroscopeForm from "../HoroscopeForm";
import { periodNames } from "../names";

export const metadata: Metadata = { title: "Edit horoscope" };

type AdminEdition = {
  id: string;
  period: HoroscopePeriod;
  startsOn: string;
  status: "draft" | "published";
  translations: Partial<Record<string, { title: string | null; intro: string | null }>>;
  readings: Partial<Record<string, Partial<Record<string, Record<string, string | null>>>>>;
};

export default function EditHoroscopePage({ params, searchParams }: PageProps<"/admin/horoscopes/[id]">) {
  return (
    <>
      <Link href="/admin/horoscopes" className="text-sm hover:text-saffron">
        ← All horoscopes
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/horoscopes/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/horoscopes/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading horoscope failed: ${res.status}`);
  const { edition } = (await res.json()) as { edition: AdminEdition };

  const initial = emptyHoroscope(edition.startsOn);
  initial.period = edition.period;
  initial.status = edition.status;
  for (const l of contentLocales) {
    const t = edition.translations[l];
    initial.translations[l] = { title: t?.title ?? "", intro: t?.intro ?? "" };
    for (const s of zodiacSigns) {
      const r = edition.readings[s]?.[l];
      if (r) for (const f of readingFields) initial.readings[s][l][f] = r[f] ?? "";
    }
  }
  const special = edition.period === "festival" || edition.period === "special";
  const viewHref = special ? `/en/horoscope/updates/${edition.id}` : `/en/horoscope?period=${edition.period}`;

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit {periodNames[edition.period].toLowerCase()} horoscope</h1>
        <div className="flex items-center gap-4">
          {edition.status === "published" && (
            <a href={viewHref} target="_blank" className="text-sm text-saffron-dark underline">
              View on site ↗
            </a>
          )}
          <DeleteButton action={deleteHoroscope.bind(null, edition.id)} confirmText="Delete this horoscope for every sign and language? This cannot be undone." />
        </div>
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {edition.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <HoroscopeForm id={edition.id} initial={initial} />
      </div>
    </>
  );
}
