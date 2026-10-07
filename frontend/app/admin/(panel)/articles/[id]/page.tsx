import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteArticle } from "@/app/admin/article-actions";
import type { ArticleFormValues } from "@/app/admin/article-actions";
import DeleteButton from "@/app/admin/DeleteButton";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import ArticleForm from "../ArticleForm";

export const metadata: Metadata = { title: "Edit article" };

type AdminArticle = Omit<ArticleFormValues, "translations" | "coverUrl"> & {
  id: string;
  coverUrl: string | null;
  translations: Partial<Record<string, { title: string; summary: string | null; body: string }>>;
};

export default function EditArticlePage({ params, searchParams }: PageProps<"/admin/articles/[id]">) {
  return (
    <>
      <Link href="/admin/articles" className="text-sm hover:text-saffron">
        ← All articles
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/articles/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/articles/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading article failed: ${res.status}`);
  const { article } = (await res.json()) as { article: AdminArticle };

  const initial: ArticleFormValues = {
    slug: article.slug,
    category: article.category,
    status: article.status,
    coverUrl: article.coverUrl ?? "",
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = article.translations[l];
        return [l, { title: t?.title ?? "", summary: t?.summary ?? "", body: t?.body ?? "" }];
      }),
    ) as ArticleFormValues["translations"],
  };

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit article</h1>
        {article.status === "published" && (
          <a href={`/en/articles/${article.slug}`} target="_blank" className="text-sm text-saffron-dark underline">
            View on site ↗
          </a>
        )}
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {article.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <ArticleForm id={article.id} initial={initial} />
      </div>
      <div className="mt-6">
        <DeleteButton
          action={deleteArticle.bind(null, article.id)}
          confirmText="Delete this article in every language? This cannot be undone."
        />
      </div>
    </>
  );
}
