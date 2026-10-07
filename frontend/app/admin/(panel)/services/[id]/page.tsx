import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteService, type ServiceFormValues, type ServiceWriting } from "@/app/admin/service-actions";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import { centsToDollars } from "../empty";
import ServiceForm from "../ServiceForm";

export const metadata: Metadata = { title: "Edit service" };

type AdminService = Omit<ServiceFormValues, "translations" | "price" | "imageUrl"> & {
  id: string;
  priceCents: number | null;
  imageUrl: string | null;
  translations: Partial<Record<string, { [K in keyof ServiceWriting]: string | null }>>;
};

export default function EditServicePage({ params, searchParams }: PageProps<"/admin/services/[id]">) {
  return (
    <>
      <Link href="/admin/services" className="text-sm hover:text-saffron">
        ← All services
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/services/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/services/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading service failed: ${res.status}`);
  const { service } = (await res.json()) as { service: AdminService };

  const initial: ServiceFormValues = {
    slug: service.slug,
    status: service.status,
    category: service.category,
    sortOrder: service.sortOrder,
    price: centsToDollars(service.priceCents),
    priceFrom: service.priceFrom,
    durationMinutes: service.durationMinutes,
    modes: service.modes,
    bookingOpen: service.bookingOpen,
    imageUrl: service.imageUrl ?? "",
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = service.translations[l];
        return [
          l,
          {
            name: t?.name ?? "",
            summary: t?.summary ?? "",
            description: t?.description ?? "",
            purpose: t?.purpose ?? "",
            requirements: t?.requirements ?? "",
            location: t?.location ?? "",
            availability: t?.availability ?? "",
          },
        ];
      }),
    ) as ServiceFormValues["translations"],
  };

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit service</h1>
        <div className="flex items-center gap-4">
          {service.status === "published" && (
            <a href={`/en/services/${service.slug}`} target="_blank" className="text-sm text-saffron-dark underline">
              View on site ↗
            </a>
          )}
          <DeleteButton action={deleteService.bind(null, service.id)} confirmText="Delete this service? This cannot be undone." />
        </div>
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {service.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <ServiceForm id={service.id} initial={initial} />
      </div>
    </>
  );
}
