import type { Metadata } from "next";
import Link from "next/link";
import ArticleForm, { emptyArticle } from "../ArticleForm";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <>
      <Link href="/admin/articles" className="text-sm hover:text-saffron">
        ← All articles
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New article</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <ArticleForm id={null} initial={emptyArticle} />
      </div>
    </>
  );
}
