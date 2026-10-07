import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteBook } from "@/app/admin/book-actions";
import type { BookFormValues } from "@/app/admin/book-actions";
import DeleteButton from "@/app/admin/DeleteButton";
import { adminFetch } from "@/lib/admin-api";
import { contentLocales } from "@/lib/articles";
import BookForm from "../BookForm";

export const metadata: Metadata = { title: "Edit book" };

type AdminBook = Omit<BookFormValues, "translations" | "publishedOn" | "pdfPublicId" | "coverUrl"> & {
  id: string;
  publishedOn: string | null;
  pdfPublicId: string | null;
  coverUrl: string | null;
  translations: Partial<Record<string, { title: string; author: string | null; description: string | null }>>;
};

export default function EditBookPage({ params, searchParams }: PageProps<"/admin/books/[id]">) {
  return (
    <>
      <Link href="/admin/books" className="text-sm hover:text-saffron">
        ← All books
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/books/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { created } = await searchParams;
  const res = await adminFetch(`/api/admin/books/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading book failed: ${res.status}`);
  const { book } = (await res.json()) as { book: AdminBook };

  const initial: BookFormValues = {
    slug: book.slug,
    status: book.status,
    category: book.category,
    language: book.language,
    publishedOn: book.publishedOn ?? "",
    featured: book.featured,
    pdfUrl: book.pdfUrl,
    pdfPublicId: book.pdfPublicId ?? "",
    pageCount: book.pageCount,
    coverUrl: book.coverUrl ?? "",
    translations: Object.fromEntries(
      contentLocales.map((l) => {
        const t = book.translations[l];
        return [l, { title: t?.title ?? "", author: t?.author ?? "", description: t?.description ?? "" }];
      }),
    ) as BookFormValues["translations"],
  };

  return (
    <>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Edit book</h1>
        <div className="flex items-center gap-4">
          {book.status === "published" && (
            <a href={`/en/books/${book.slug}`} target="_blank" className="text-sm text-saffron-dark underline">
              View on site ↗
            </a>
          )}
          <DeleteButton
            action={deleteBook.bind(null, book.id)}
            confirmText="Delete this book and its PDF? This cannot be undone."
          />
        </div>
      </div>
      {created && (
        <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-900">
          {book.status === "published" ? "Published." : "Saved as a draft."}
        </p>
      )}
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <BookForm id={book.id} initial={initial} />
      </div>
    </>
  );
}
