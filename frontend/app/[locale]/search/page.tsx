import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { zodiacSigns } from "@/lib/horoscopes";
import { publicJson } from "@/lib/public-api";
import type { SearchResults } from "@/lib/search";

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search" });
  // Result pages for every possible word would only crowd search engines
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Search");
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <Suspense fallback={<div className="mt-8 h-60" />}>
        <Results locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const sectionClass = "mt-10";
const headingClass = "font-serif text-2xl text-maroon";
const listClass = "mt-3 divide-y divide-gold/20 rounded-xl border border-gold/30 bg-warm-white";
const itemClass = "block px-4 py-3 hover:bg-cream";

async function Results({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const t = await getTranslations({ locale, namespace: "Search" });
  const h = await getTranslations({ locale, namespace: "Horoscope" });

  const data = q.length >= 2 ? await publicJson<SearchResults>(`/api/search?${new URLSearchParams({ q, locale })}`) : null;
  const r = data?.results;
  // Zodiac signs are not in the database, so match their names here
  const needle = q.toLocaleLowerCase();
  const signs = q.length >= 2 ? zodiacSigns.filter((s) => s.includes(needle) || h(`signs.${s}`).toLocaleLowerCase().includes(needle)) : [];
  const count = signs.length + (r ? r.articles.length + r.books.length + r.videos.length + r.services.length + r.events.length : 0);
  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { dateStyle: "long", timeZone: "UTC" });

  return (
    <>
      <form action={getPathname({ href: "/search", locale })} role="search" className="mt-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          minLength={2}
          maxLength={100}
          autoFocus={!q}
          className="min-w-0 flex-1 rounded-full border border-gold/40 bg-warm-white px-4 py-2 focus:border-saffron focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark">
          {t("button")}
        </button>
      </form>

      {!q && <p className="mt-6 text-charcoal/70">{t("hint")}</p>}
      {q && q.length < 2 && <p className="mt-6 text-charcoal/70">{t("tooShort")}</p>}
      {q.length >= 2 && !data && <p className="mt-6 rounded bg-red-50 p-3 text-sm text-red-800">{t("failed")}</p>}
      {data && (
        <p className="mt-6 text-charcoal/70" role="status">
          {count === 0 ? t("none", { q }) : t("count", { count, q })}
        </p>
      )}

      {signs.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("horoscope")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {signs.map((s) => (
              <li key={s}>
                <Link href={`/horoscope/${s}`} className="inline-block rounded-full border border-saffron/50 bg-warm-white px-4 py-2 hover:bg-saffron/10">
                  {h(`signs.${s}`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.services.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("services")}</h2>
          <ul className={listClass}>
            {r.services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className={itemClass}>
                  <span lang={s.locale} className="font-medium text-maroon">
                    {s.name}
                  </span>
                  {s.summary && (
                    <span lang={s.locale} className="mt-1 block text-sm text-charcoal/70">
                      {s.summary}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.articles.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("articles")}</h2>
          <ul className={listClass}>
            {r.articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}`} className={itemClass}>
                  <span lang={a.locale} className="font-medium text-maroon">
                    {a.title}
                  </span>
                  {a.summary && (
                    <span lang={a.locale} className="mt-1 block text-sm text-charcoal/70">
                      {a.summary}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.videos.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("videos")}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {r.videos.map((v) => (
              <li key={v.youtubeId}>
                <Link href={`/pravachan/${v.youtubeId}`} className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
                  <img
                    src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full rounded-lg border border-gold/30 object-cover"
                  />
                  <span lang={v.locale} className="mt-2 block text-sm font-medium text-maroon group-hover:text-saffron">
                    {v.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.books.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("books")}</h2>
          <ul className={listClass}>
            {r.books.map((b) => (
              <li key={b.slug}>
                <Link href={`/books/${b.slug}`} className={itemClass}>
                  <span lang={b.locale} className="font-medium text-maroon">
                    {b.title}
                  </span>
                  {b.author && (
                    <span lang={b.locale} className="mt-1 block text-sm text-charcoal/70">
                      {b.author}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.events.length > 0 && (
        <section className={sectionClass}>
          <h2 className={headingClass}>{t("events")}</h2>
          <ul className={listClass}>
            {r.events.map((e) => (
              <li key={e.slug}>
                <Link href={`/events/${e.slug}`} className={itemClass}>
                  <span lang={e.locale} className="font-medium text-maroon">
                    {e.name}
                  </span>
                  <span className="mt-1 block text-sm text-charcoal/70">
                    {dateFormat.format(new Date(`${e.date}T12:00:00Z`))}
                    {e.location && <span lang={e.locale}> · {e.location}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
