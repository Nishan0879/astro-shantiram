import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FestivalForm, { emptyFestival } from "../FestivalForm";
import { bookableServices } from "../services";

export const metadata: Metadata = { title: "Add a day" };

export default function NewFestivalPage() {
  return (
    <>
      <Link href="/admin/festivals" className="text-sm hover:text-saffron">
        ← Festival calendar
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">Add a day</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
          <Form />
        </Suspense>
      </div>
    </>
  );
}

async function Form() {
  return <FestivalForm id={null} initial={emptyFestival} services={await bookableServices()} />;
}
