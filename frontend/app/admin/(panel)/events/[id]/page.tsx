import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DeleteButton from "@/app/admin/DeleteButton";
import { deleteEvent, type EventFormValues } from "@/app/admin/event-actions";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import EventForm from "../EventForm";

export const metadata: Metadata = { title: "Edit event" };

type AdminEvent = {
  id: string;
  slug: string;
  status: "draft" | "published";
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  registrationUrl: string | null;
  youtubeUrl: string | null;
  zoomUrl: string | null;
  translations: Partial<Record<string, { name: string; location: string | null; description: string | null }>>;
};

export default function EditEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  return (
    <>
      <Link href="/admin/events" className="text-sm hover:text-saffron">
        ← All events
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/events/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/events/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading event failed: ${res.status}`);
  const { event } = (await res.json()) as { event: AdminEvent };

  const initial: EventFormValues = {
    slug: event.slug,
    status: event.status,
    eventDate: event.eventDate,
    startTime: event.startTime?.slice(0, 5) ?? "",
    endTime: event.endTime?.slice(0, 5) ?? "",
    registrationUrl: event.registrationUrl ?? "",
    youtubeUrl: event.youtubeUrl ?? "",
    zoomUrl: event.zoomUrl ?? "",
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = event.translations[l];
        return [l, { name: t?.name ?? "", location: t?.location ?? "", description: t?.description ?? "" }];
      }),
    ) as EventFormValues["translations"],
  };

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit event</h1>
        {event.status === "published" && (
          <a href={`/en/events/${event.slug}`} target="_blank" className="text-sm text-saffron-dark underline">
            View on site ↗
          </a>
        )}
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {event.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <EventForm id={event.id} initial={initial} />
      </div>
      <div className="mt-6">
        <DeleteButton action={deleteEvent.bind(null, event.id)} confirmText="Delete this event? This cannot be undone." />
      </div>
    </>
  );
}
