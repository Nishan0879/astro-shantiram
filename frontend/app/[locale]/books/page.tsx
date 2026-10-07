import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { bookCategories, bookCover, type BookList } from "@/lib/books";
import { publicJson } from "@/lib/public-api";

export async function generateMetadata({ params }: PageProps<"/[locale]/books">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Books" });
  return { title: t("title"), description: t("intro") };
}

export default function BooksPage({ params, searchParams }: PageProps<"/[locale]/books">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Books");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-60" />}>
        <BookListing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BookListing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/books">["searchParams"];
}) {
  const sp = await searchParams;
  const category = bookCategories.find((c) => c === sp.category);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations({ locale, namespace: "Books" });

  const query = new URLSearchParams({ locale, page: String(page) });
  if (category) query.set("category", category);
  if (q) query.set("q", q);
  const data = await publicJson<BookList>(`/api/books?${query}`);
  const { books, total, pageSize } = data ?? { books: [], total: 0, pageSize: 12 };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const href = (c?: string, p = 1) => ({
    pathname: "/books" as const,
    query: { ...(c ? { category: c } : {}), ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) },
  });

  return (
    <>
      <form action={getPathname({ href: "/books", locale })} role="search" className="mt-8 flex max-w-xl gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="min-w-0 flex-1 rounded-full border border-gold/40 bg-warm-white px-4 py-2 focus:border-saffron focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark">
          {t("search")}
        </button>
      </form>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {[undefined, ...bookCategories].map((c) => (
          <Link
            key={c ?? "all"}
            href={href(c)}
            className={`rounded-full border px-3 py-1 ${
              c === category ? "border-saffron bg-saffron text-white" : "border-gold/40 hover:border-saffron"
            }`}
          >
            {c ? t(`categories.${c}`) : t("all")}
          </Link>
        ))}
      </nav>

      {books.length === 0 ? (
        <p className="mt-10 text-charcoal/70">
          {q ? t("noResults", { q }) : t("empty")}{" "}
          {q && (
            <Link href={{ pathname: "/books", query: category ? { category } : {} }} className="text-saffron hover:underline">
              {t("clear")}
            </Link>
          )}
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <li key={b.slug}>
              <Link href={`/books/${b.slug}`} className="group block">
                <div className="relative overflow-hidden rounded-lg border border-gold/30 bg-cream shadow-sm group-hover:shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes it */}
                  <img
                    src={bookCover(b, "c_fill,g_north,w_400,h_560")}
                    alt=""
                    loading="lazy"
                    className="aspect-[5/7] w-full object-cover"
                  />
                  {b.featured && (
                    <span className="absolute left-2 top-2 rounded-full bg-maroon px-2 py-0.5 text-xs text-white">
                      {t("featured")}
                    </span>
                  )}
                </div>
                <h2 lang={b.locale} className="mt-3 font-serif text-lg leading-snug text-maroon group-hover:text-saffron">
                  {b.title}
                </h2>
                {b.author && (
                  <p lang={b.locale} className="mt-1 text-sm text-charcoal/70">
                    {b.author}
                  </p>
                )}
                <p className="mt-1 text-xs text-gold">{t(`categories.${b.category}`)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-10 flex justify-between">
          {page > 1 ? <Link href={href(category, page - 1)} className="text-saffron hover:underline">← {t("previous")}</Link> : <span />}
          {page < pages ? <Link href={href(category, page + 1)} className="text-saffron hover:underline">{t("next")} →</Link> : <span />}
        </div>
      )}
    </>
  );
}
