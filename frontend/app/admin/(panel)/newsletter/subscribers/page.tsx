import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate } from "@/lib/admin-api";
import type { Subscriber } from "@/lib/newsletter";
import DeleteButton from "../../../DeleteButton";
import { deleteSubscriber } from "../../../newsletter-actions";

export const metadata: Metadata = { title: "Subscribers" };

const statusName = { subscribed: "Subscribed", pending: "Waiting to confirm", unsubscribed: "Unsubscribed" };
const languages: Record<string, string> = { en: "English", ne: "Nepali", sa: "Sanskrit" };

export default function SubscribersPage() {
  return (
    <>
      <Link href="/admin/newsletter" className="text-sm hover:text-saffron">
        ← Newsletter
      </Link>
      <h1 className="mb-1 mt-2 font-serif text-2xl text-maroon">Subscribers</h1>
      <p className="mb-4 text-sm text-charcoal/70">
        People leave with the link in every email. Delete someone only if they ask to have their address removed completely.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const { subscribers } = await adminJson<{ subscribers: Subscriber[] }>("/api/admin/newsletter/subscribers");
  if (subscribers.length === 0) return <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">Nobody has signed up yet.</p>;
  return (
    <ul className="divide-y divide-gold/20 rounded-xl border border-gold/30 bg-warm-white">
      {subscribers.map((s) => (
        <li key={s.id} className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="break-all">{s.email}</div>
            <div className="text-xs text-charcoal/60">
              {statusName[s.status]} · {languages[s.locale ?? "en"] ?? s.locale} · signed up {formatDate(s.createdAt)}
            </div>
          </div>
          <DeleteButton action={deleteSubscriber.bind(null, s.id)} confirmText={`Remove ${s.email} completely?`} />
        </li>
      ))}
    </ul>
  );
}
