import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setMessageStatus } from "@/app/admin/actions";
import { adminFetch, type ContactMessage, formatDate, type MessageStatus } from "@/lib/admin-api";
import { secondaryButtonClass, statusStyles } from "../../../styles";
import DeleteButton from "./DeleteButton";

export const metadata: Metadata = { title: "Message" };

const languages: Record<string, string> = { en: "English", ne: "Nepali", sa: "Sanskrit" };

export default function MessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  return (
    <>
      <Link href="/admin/messages" className="text-sm hover:text-saffron">
        ← All messages
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Message params={params} />
      </Suspense>
    </>
  );
}

async function Message({ params }: Pick<PageProps<"/admin/messages/[id]">, "params">) {
  const { id } = await params;
  const res = await adminFetch(`/api/admin/contact-messages/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading message failed: ${res.status}`);
  const { message: m } = (await res.json()) as { message: ContactMessage };

  const statusButtons: { status: MessageStatus; label: string }[] = [
    { status: "replied", label: "Mark as replied" },
    { status: "archived", label: "Archive" },
    { status: "new", label: "Mark as unread" },
  ];
  const replyHref = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`;

  return (
    <article className="mt-4 rounded-xl border border-gold/30 bg-warm-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-xl text-maroon">{m.subject}</h1>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${statusStyles[m.status]}`}>
          {m.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-charcoal/60">From</dt>
        <dd>{m.name}</dd>
        <dt className="text-charcoal/60">Email</dt>
        <dd className="break-all">
          <a href={`mailto:${m.email}`} className="text-saffron-dark underline">{m.email}</a>
        </dd>
        {m.phone && (
          <>
            <dt className="text-charcoal/60">Phone</dt>
            <dd>
              <a href={`tel:${m.phone}`} className="text-saffron-dark underline">{m.phone}</a>
            </dd>
          </>
        )}
        <dt className="text-charcoal/60">Topic</dt>
        <dd className="capitalize">{m.category}</dd>
        {m.locale && (
          <>
            <dt className="text-charcoal/60">Language</dt>
            <dd>{languages[m.locale] ?? m.locale}</dd>
          </>
        )}
        <dt className="text-charcoal/60">Received</dt>
        <dd>{formatDate(m.createdAt)} (Nepal time)</dd>
      </dl>

      <p className="mt-5 whitespace-pre-wrap break-words border-t border-gold/20 pt-4">{m.message}</p>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-gold/20 pt-4">
        <a href={replyHref} className="rounded-full bg-saffron px-4 py-2 text-sm font-medium text-white hover:bg-saffron-dark">
          Reply by email
        </a>
        {statusButtons
          .filter((b) => b.status !== m.status)
          .map((b) => (
            <form key={b.status} action={setMessageStatus.bind(null, m.id, b.status)}>
              <button type="submit" className={secondaryButtonClass}>
                {b.label}
              </button>
            </form>
          ))}
        <DeleteButton id={m.id} />
      </div>
    </article>
  );
}
