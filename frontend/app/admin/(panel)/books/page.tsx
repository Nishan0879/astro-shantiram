import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminJson, formatDate } from "@/lib/admin-api";
import { bookCover, type BookCategory } from "@/lib/books";
import { primaryButtonClass } from "../../styles";
import { bookCategoryNames } from "./names";

export const metadata: Metadata = { title: "Books" };

type AdminBookRow = {
  id: string;
  title: string;
  status: "draft" | "published";
  category: BookCategory;
  featured: boolean;
  pdfUrl: string;
  coverUrl: string | null;
  locales: string[];
  updatedAt: string;
};

export default function BooksAdminPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-maroon">Books</h1>
        <Link href="/admin/books/new" className={primaryButtonClass}>
          Add a book
        </Link>
      </div>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <BookRows />
      </Suspense>
    </>
  );
}

async function BookRows() {
  const { books } = await adminJson<{ books: AdminBookRow[] }>("/api/admin/books");
  if (books.length === 0) {
    return (
      <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
        No books yet. Tap “Add a book” and upload the first PDF.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gold/20 overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {books.map((b) => (
        <li key={b.id}>
          <Link href={`/admin/books/${b.id}`} className="flex gap-3 p-4 hover:bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bookCover(b, "c_fill,w_96,h_128")} alt="" className="h-16 w-12 shrink-0 rounded bg-cream object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">
                  {b.featured && <span title="Featured">★ </span>}
                  {b.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    b.status === "published" ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70"
                  }`}
                >
                  {b.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-xs text-charcoal/60">
                <span>
                  {bookCategoryNames[b.category]} · <span className="uppercase">{b.locales.join(" · ")}</span>
                </span>
                <span>Edited {formatDate(b.updatedAt)}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
