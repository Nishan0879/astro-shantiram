import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate } from "@/lib/admin-api";
import type { NewsletterIssue, SubscriberCounts } from "@/lib/newsletter";
import { primaryButtonClass } from "../../styles";

export const metadata: Metadata = { title: "Newsletter" };

const statusLabel = { draft: "Draft", sending: "Sending…", sent: "Sent" };
const statusClass = { draft: "bg-gold/20 text-charcoal", sending: "bg-saffron text-white", sent: "bg-green-100 text-green-900" };

export default function NewsletterPage() {
  return (
    <>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Newsletter</h1>
        <Link href="/admin/newsletter/new" className={primaryButtonClass}>
          Write an update
        </Link>
      </div>
      <p className="mb-4 text-sm text-charcoal/70">
        Visitors sign up at the bottom of every page and confirm by email. Updates you write here go to everyone who confirmed.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const { issues, counts, emailReady } = await adminJson<{ issues: NewsletterIssue[]; counts: SubscriberCounts; emailReady: boolean }>("/api/admin/newsletter");
  const cards = [
    { label: "Subscribers", value: counts.subscribed },
    { label: "Waiting to confirm", value: counts.pending },
    { label: "Unsubscribed", value: counts.unsubscribed },
  ];
  return (
    <div className="space-y-4">
      {!emailReady && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">Email is not set up yet, so sign-up and update emails cannot be sent.</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href="/admin/newsletter/subscribers" className="rounded-xl border border-gold/30 bg-warm-white p-4 hover:border-saffron">
            <div className="text-3xl font-semibold text-maroon">{c.value}</div>
            <div className="text-sm text-charcoal/70">{c.label}</div>
          </Link>
        ))}
      </div>
      <section>
        <h2 className="mb-2 font-medium">Updates</h2>
        {issues.length === 0 ? (
          <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">No updates yet. Write the first one when there is news, such as an upcoming festival.</p>
        ) : (
          <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
            {issues.map((i) => (
              <li key={i.id}>
                <Link href={`/admin/newsletter/${i.id}`} className="block p-4 hover:bg-cream">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate font-medium">{i.subject}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass[i.status]}`}>{statusLabel[i.status]}</span>
                  </div>
                  <div className="mt-1 text-xs text-charcoal/60">
                    {i.status === "draft"
                      ? `Last saved ${formatDate(i.updatedAt)}`
                      : `${i.sentCount} of ${i.recipientCount} sent${i.sentAt ? ` · ${formatDate(i.sentAt)}` : ""}`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
