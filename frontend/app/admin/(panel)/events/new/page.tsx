import type { Metadata } from "next";
import Link from "next/link";
import EventForm, { emptyEvent } from "../EventForm";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <Link href="/admin/events" className="text-sm hover:text-saffron">
        ← All events
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New event</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <EventForm id={null} initial={emptyEvent} />
      </div>
    </>
  );
}
