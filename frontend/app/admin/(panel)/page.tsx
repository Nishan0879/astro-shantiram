import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { adminJson, type MessageList } from "@/lib/admin-api";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl text-maroon">Overview</h1>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Metrics />
      </Suspense>
    </>
  );
}

async function Metrics() {
  const [{ counts, total }, { articles }, { events }, bookings] = await Promise.all([
    adminJson<MessageList>("/api/admin/contact-messages"),
    adminJson<{ articles: { status: string }[] }>("/api/admin/articles"),
    adminJson<{ events: { status: string; isUpcoming: boolean }[] }>("/api/admin/events"),
    // Left out for accounts that do not manage appointments, and before the booking tables exist
    adminJson<{ counts: { requests: number; today: number } }>("/api/admin/appointments?view=requests").catch((err) => {
      unstable_rethrow(err);
      return null;
    }),
  ]);
  const cards = [
    ...(bookings
      ? [
          {
            label: "Bookings waiting for you",
            value: bookings.counts.requests,
            href: "/admin/appointments",
            highlight: bookings.counts.requests > 0,
          },
          { label: "Bookings today", value: bookings.counts.today, href: "/admin/appointments?view=upcoming" },
        ]
      : []),
    { label: "New messages", value: counts.new, href: "/admin/messages?status=new", highlight: counts.new > 0 },
    { label: "Awaiting reply", value: counts.read, href: "/admin/messages?status=read" },
    { label: "All messages", value: total, href: "/admin/messages" },
    {
      label: "Published articles",
      value: articles.filter((a) => a.status === "published").length,
      href: "/admin/articles",
    },
    {
      label: "Upcoming events",
      value: events.filter((e) => e.status === "published" && e.isUpcoming).length,
      href: "/admin/events",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`rounded-xl border p-4 hover:border-saffron ${
            card.highlight ? "border-saffron bg-saffron/10" : "border-gold/30 bg-warm-white"
          }`}
        >
          <div className="text-3xl font-semibold text-maroon">{card.value}</div>
          <div className="text-sm text-charcoal/70">{card.label}</div>
        </Link>
      ))}
    </div>
  );
}
