import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { todayInSiteZone } from "@/lib/site";
import { emptyHoroscope } from "../empty";
import HoroscopeForm from "../HoroscopeForm";

export const metadata: Metadata = { title: "New horoscope" };

export default function NewHoroscopePage() {
  return (
    <>
      <Link href="/admin/horoscopes" className="text-sm hover:text-saffron">
        ← All horoscopes
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New horoscope</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
          <Form />
        </Suspense>
      </div>
    </>
  );
}

async function Form() {
  // Today's date in Central time, read per visit
  await connection();
  return <HoroscopeForm id={null} initial={emptyHoroscope(todayInSiteZone())} />;
}
