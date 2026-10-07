import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate, type MessageList, messageStatuses } from "@/lib/admin-api";
import { statusStyles } from "../../styles";

export const metadata: Metadata = { title: "Messages" };

const filters = [{ value: undefined, label: "All" }, ...messageStatuses.map((s) => ({ value: s, label: s }))];

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl text-maroon">Contact messages</h1>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <Messages searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Messages({ searchParams }: Pick<PageProps<"/admin/messages">, "searchParams">) {
  const params = await searchParams;
  const status = messageStatuses.find((s) => s === params.status);
  const page = Math.max(1, Number(params.page) || 1);

  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  const { messages, counts, total, pageSize } = await adminJson<MessageList>(
    `/api/admin/contact-messages?${query}`,
  );
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const href = (s: string | undefined, p = 1) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/admin/messages${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={href(f.value)}
            className={`rounded-full border px-3 py-1 capitalize ${
              f.value === status ? "border-saffron bg-saffron text-white" : "border-gold/40 bg-white"
            }`}
          >
            {f.label} ({f.value ? counts[f.value] : allCount})
          </Link>
        ))}
      </div>

      {messages.length === 0 ? (
        <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">No messages here.</p>
      ) : (
        <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
          {messages.map((m) => (
            <li key={m.id}>
              {/* No prefetch: opening a message marks it read */}
              <Link href={`/admin/messages/${m.id}`} prefetch={false} className="block p-4 hover:bg-cream">
                <div className="flex items-start justify-between gap-3">
                  <span className={`truncate ${m.status === "new" ? "font-semibold" : ""}`}>{m.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${statusStyles[m.status]}`}>
                    {m.status}
                  </span>
                </div>
                <div className={`truncate ${m.status === "new" ? "font-medium" : ""}`}>{m.subject}</div>
                <div className="mt-1 flex justify-between gap-3 text-xs text-charcoal/60">
                  <span className="capitalize">{m.category}</span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(status, page - 1)} className="hover:text-saffron">← Newer</Link> : <span />}
          <span className="text-charcoal/60">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(status, page + 1)} className="hover:text-saffron">Older →</Link> : <span />}
        </div>
      )}
    </>
  );
}
