import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate } from "@/lib/admin-api";
import { primaryButtonClass } from "../../styles";

export const metadata: Metadata = { title: "Articles" };

type AdminArticleRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  locales: string[];
  updatedAt: string;
};

export default function ArticlesAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Articles</h1>
        <Link href="/admin/articles/new" className={primaryButtonClass}>
          New article
        </Link>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <ArticleRows />
      </Suspense>
    </>
  );
}

async function ArticleRows() {
  const { articles } = await adminJson<{ articles: AdminArticleRow[] }>("/api/admin/articles");
  if (articles.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
        No articles yet. Tap “New article” to write the first one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {articles.map((a) => (
        <li key={a.id}>
          <Link href={`/admin/articles/${a.id}`} className="block p-4 hover:bg-cream">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{a.title}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  a.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                }`}
              >
                {a.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-xs text-charcoal/60">
              <span className="uppercase">{a.locales.join(" · ")}</span>
              <span>Edited {formatDate(a.updatedAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
