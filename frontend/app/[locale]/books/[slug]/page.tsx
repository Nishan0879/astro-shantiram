import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { bookCover, pdfDownloadUrl } from "@/lib/books";
import { getBook } from "./data";

async function getCachedMeta(slug: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  try {
    const book = await getBook(slug, locale);
    if (!book) return null;
    return {
      title: book.title,
      description: book.description?.slice(0, 200) ?? undefined,
      openGraph: { images: [bookCover(book, "c_pad,b_white,w_1200,h_630")] },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/books/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = await getCachedMeta(slug, locale);
  if (meta) return meta;
  const t = await getTranslations({ locale, namespace: "Books" });
  return { title: t("title") };
}

export default function BookPage({ params }: PageProps<"/[locale]/books/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Suspense fallback={<div className="h-96" />}>
        <BookDetails params={params} />
      </Suspense>
    </div>
  );
}

async function BookDetails({ params }: Pick<PageProps<"/[locale]/books/[slug]">, "params">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const book = await getBook(slug, locale);
  if (!book) notFound();
  const t = await getTranslations({ locale, namespace: "Books" });
  const format = await getFormatter({ locale });

  const facts = [
    [t("topic"), t(`categories.${book.category}`)],
    [t("writtenIn"), t(`languages.${book.language}`)],
    book.pageCount ? [null, t("pages", { count: book.pageCount })] : null,
    book.publishedOn
      ? [t("publishedOn"), format.dateTime(new Date(`${book.publishedOn}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" })]
      : null,
  ].filter((f) => f !== null);

  return (
    <>
      <Link href="/books" className="text-sm text-saffron hover:underline">
        ← {t("back")}
      </Link>
      {book.locale !== locale && (
        <p className="mt-6 rounded-lg bg-cream p-4 text-sm">
          {t("otherLanguage", { language: t(`languages.${book.locale}`) })}
        </p>
      )}
      <div className="mt-6 grid gap-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Link href={`/books/${book.slug}/read`} className="mx-auto block w-56 sm:w-full" tabIndex={-1} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes it */}
          <img
            src={bookCover(book, "c_fill,g_north,w_600,h_840")}
            alt=""
            className="aspect-[5/7] w-full rounded-lg border border-gold/30 bg-cream object-cover shadow-md"
          />
        </Link>
        <div lang={book.locale}>
          <h1 className="font-serif text-3xl text-maroon sm:text-4xl">{book.title}</h1>
          {book.author && <p className="mt-2 text-lg text-charcoal/80">{t("by", { author: book.author })}</p>}
          <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal/70" lang={locale}>
            {facts.map(([label, value]) => (
              <div key={value} className="flex gap-1">
                {label && <dt>{label}:</dt>}
                <dd className="text-charcoal">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3" lang={locale}>
            <Link
              href={`/books/${book.slug}/read`}
              className="rounded-full bg-saffron px-5 py-2.5 font-medium text-white hover:bg-saffron-dark"
            >
              {t("read")}
            </Link>
            <a
              href={pdfDownloadUrl(book.pdfUrl)}
              className="rounded-full border border-saffron px-5 py-2.5 font-medium text-saffron-dark hover:bg-cream"
            >
              {t("download")}
            </a>
          </div>
          {book.description && (
            <div className="mt-8 space-y-4 whitespace-pre-line leading-relaxed">{book.description}</div>
          )}
        </div>
      </div>
    </>
  );
}
