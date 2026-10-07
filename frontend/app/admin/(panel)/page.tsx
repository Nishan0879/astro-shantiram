import type { Metadata } from "next";
import Link from "next/link";
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
      <p className="mt-8 text-sm text-charcoal/60">
        Appointments and the gallery will appear here as they are added.
      </p>
    </>
  );
}

async function Metrics() {
  const [{ counts, total }, { articles }, { events }] = await Promise.all([
    adminJson<MessageList>("/api/admin/contact-messages"),
    adminJson<{ articles: { status: string }[] }>("/api/admin/articles"),
    adminJson<{ events: { status: string; isUpcoming: boolean }[] }>("/api/admin/events"),
  ]);
  const cards = [
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
