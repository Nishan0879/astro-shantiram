import type { Metadata } from "next";
import Link from "next/link";
import BookForm, { emptyBook } from "../BookForm";

export const metadata: Metadata = { title: "New book" };

export default function NewBookPage() {
  return (
    <>
      <Link href="/admin/books" className="text-sm hover:text-saffron">
        ← All books
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">New book</h1>
      <div className="rounded-xl border border-gold/30 bg-warm-white p-5">
        <BookForm id={null} initial={emptyBook} />
      </div>
    </>
  );
}
