import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteFestival, type FestivalFormValues } from "@/app/admin/festival-actions";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import type { FestivalKind } from "@/lib/festivals";
import FestivalForm from "../FestivalForm";
import { bookableServices } from "../services";

export const metadata: Metadata = { title: "Edit day" };

type AdminFestival = {
  id: string;
  date: string;
  endDate: string | null;
  kind: FestivalKind;
  status: "draft" | "published";
  serviceSlug: string | null;
  translations: Partial<Record<string, { name: string; description: string | null }>>;
};

export default function EditFestivalPage({ params }: PageProps<"/admin/festivals/[id]">) {
  return (
    <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/festivals/[id]">, "params">) {
  const { id } = await params;
  const res = await adminFetch(`/api/admin/festivals/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading festival failed: ${res.status}`);
  const { festival } = (await res.json()) as { festival: AdminFestival };
  const year = festival.date.slice(0, 4);

  const initial: FestivalFormValues = {
    date: festival.date,
    endDate: festival.endDate ?? "",
    kind: festival.kind,
    status: festival.status,
    serviceSlug: festival.serviceSlug ?? "",
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = festival.translations[l];
        return [l, { name: t?.name ?? "", description: t?.description ?? "" }];
      }),
    ) as FestivalFormValues["translations"],
  };

  return (
    <>
      <Link href={`/admin/festivals?year=${year}`} className="text-sm hover:text-saffron">
        ← Festival calendar {year}
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit day</h1>
        <DeleteButton action={deleteFestival.bind(null, festival.id, year)} confirmText="Delete this day from the calendar? This cannot be undone." />
      </div>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <FestivalForm id={festival.id} initial={initial} services={await bookableServices()} />
      </div>
    </>
  );
}
