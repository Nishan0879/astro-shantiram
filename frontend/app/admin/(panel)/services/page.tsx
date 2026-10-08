import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson } from "@/lib/admin-api";
import { formatPrice, serviceCategories, type ServiceCategory } from "@/lib/services";
import { primaryButtonClass } from "../../styles";
import { serviceCategoryNames } from "./names";

export const metadata: Metadata = { title: "Services" };

type AdminServiceRow = {
  id: string;
  name: string;
  status: "draft" | "published";
  category: ServiceCategory;
  sortOrder: number;
  priceCents: number | null;
  priceFrom: boolean;
  durationMinutes: number | null;
  bookingOpen: boolean;
  locales: string[];
};

export default function ServicesAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Services</h1>
        <Link href="/admin/services/new" className={primaryButtonClass}>
          Add a service
        </Link>
      </div>
      <p className="mb-4 text-sm text-charcoal/70">Tap a service to set its price, length, description and photo.</p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <ServiceRows />
      </Suspense>
    </>
  );
}

function length(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(" ");
}

async function ServiceRows() {
  const { services } = await adminJson<{ services: AdminServiceRow[] }>("/api/admin/services");
  if (services.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">No services yet. Tap “Add a service” to add the first one.</p>
    );
  }

  return serviceCategories.map((category) => {
    const rows = services.filter((s) => s.category === category);
    if (rows.length === 0) return null;
    return (
      <section key={category} className="mb-6">
        <h2 className="mb-2 font-serif text-xl text-maroon">{serviceCategoryNames[category]}</h2>
        <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/services/${s.id}`} className="block p-4 hover:bg-cream">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{s.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      s.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                    }`}
                  >
                    {s.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-charcoal/60">
                  <span>
                    {s.priceCents === null ? "No price set" : `${s.priceFrom ? "From " : ""}${formatPrice(s.priceCents, "en")}`}
                    {s.durationMinutes ? ` · ${length(s.durationMinutes)}` : ""}
                    {!s.bookingOpen && " · Not taking requests"}
                  </span>
                  <span className="uppercase">{s.locales.join(" · ")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  });
}
