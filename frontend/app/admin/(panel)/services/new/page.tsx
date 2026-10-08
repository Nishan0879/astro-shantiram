import type { Metadata } from "next";
import Link from "next/link";
import { emptyService } from "../empty";
import ServiceForm from "../ServiceForm";

export const metadata: Metadata = { title: "New service" };

export default function NewServicePage() {
  return (
    <>
      <Link href="/admin/services" className="text-sm hover:text-saffron">
        ← All services
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New service</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <ServiceForm id={null} initial={emptyService} />
      </div>
    </>
  );
}
