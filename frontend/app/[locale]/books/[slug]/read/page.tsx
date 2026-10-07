import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { pdfDownloadUrl } from "@/lib/books";
import { getBook } from "../data";
import ReaderLoader from "./ReaderLoader";

export async function generateMetadata({ params }: PageProps<"/[locale]/books/[slug]/read">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Books" });
  // The book page is the one to share and index, not the reader
  return { title: t("title"), robots: { index: false } };
}

export default function ReadBookPage({ params }: PageProps<"/[locale]/books/[slug]/read">) {
  return (
    <Suspense fallback={<div className="h-[80vh]" />}>
      <Reading params={params} />
    </Suspense>
  );
}

async function Reading({ params }: Pick<PageProps<"/[locale]/books/[slug]/read">, "params">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const book = await getBook(slug, locale);
  if (!book) notFound();

  return (
    <ReaderLoader
      slug={book.slug}
      title={book.title}
      titleLocale={book.locale}
      pdfUrl={book.pdfUrl}
      downloadUrl={pdfDownloadUrl(book.pdfUrl)}
    />
  );
}
