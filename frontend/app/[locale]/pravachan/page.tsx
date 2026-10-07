import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import VideoCard from "@/components/VideoCard";
import { getPathname, Link } from "@/i18n/navigation";
import { bookLanguages } from "@/lib/books";
import { publicJson } from "@/lib/public-api";
import { youtubeChannelUrl } from "@/lib/site";
import { videoCategories, type VideoList } from "@/lib/videos";

export async function generateMetadata({ params }: PageProps<"/[locale]/pravachan">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pravachan" });
  return { title: t("title"), description: t("intro") };
}

export default function PravachanPage({ params, searchParams }: PageProps<"/[locale]/pravachan">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Pravachan");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
        </div>
        <a
          href={youtubeChannelUrl}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-saffron px-4 py-2 text-sm font-medium text-saffron-dark hover:bg-cream"
        >
          {t("subscribe")} ↗
        </a>
      </div>
      <Suspense fallback={<div className="mt-10 h-60" />}>
        <VideoListing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VideoListing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/pravachan">["searchParams"];
}) {
  const sp = await searchParams;
  const category = videoCategories.find((c) => c === sp.category);
  const language = bookLanguages.find((l) => l === sp.language);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations({ locale, namespace: "Pravachan" });
  const filtered = Boolean(category || language || q);

  const query = new URLSearchParams({ locale, page: String(page) });
  if (category) query.set("category", category);
  if (language) query.set("language", language);
  if (q) query.set("q", q);
  const [data, featured] = await Promise.all([
    publicJson<VideoList>(`/api/videos?${query}`),
    !filtered && page === 1 ? publicJson<VideoList>(`/api/videos?locale=${locale}&featured=1&limit=3`) : null,
  ]);
  const { videos, total, pageSize } = data ?? { videos: [], total: 0, pageSize: 12 };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const highlights = featured?.videos ?? [];

  const keep = { ...(language ? { language } : {}), ...(q ? { q } : {}) };
  const href = (c?: string, p = 1) => ({
    pathname: "/pravachan" as const,
    query: { ...(c ? { category: c } : {}), ...keep, ...(p > 1 ? { page: String(p) } : {}) },
  });

  return (
    <>
      <form action={getPathname({ href: "/pravachan", locale })} role="search" className="mt-8 flex max-w-2xl flex-wrap gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="min-w-0 flex-1 basis-48 rounded-full border border-gold/40 bg-warm-white px-4 py-2 focus:border-saffron focus:outline-none"
        />
        <select
          name="language"
          defaultValue={language ?? ""}
          aria-label={t("language")}
          className="rounded-full border border-gold/40 bg-warm-white px-3 py-2"
        >
          <option value="">{t("allLanguages")}</option>
          {bookLanguages.map((l) => (
            <option key={l} value={l}>
              {t(`languages.${l}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark">
          {t("search")}
        </button>
      </form>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {[undefined, ...videoCategories].map((c) => (
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

      {highlights.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl text-maroon">{t("featured")}</h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((v) => (
              <li key={v.youtubeId}>
                <VideoCard video={v} large />
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length === 0 ? (
        <p className="mt-10 text-charcoal/70">
          {q ? t("noResults", { q }) : t("empty")}{" "}
          {filtered && (
            <Link href="/pravachan" className="text-saffron hover:underline">
              {t("clear")}
            </Link>
          )}
        </p>
      ) : (
        <section className="mt-10">
          {highlights.length > 0 && <h2 className="font-serif text-2xl text-maroon">{t("latest")}</h2>}
          <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <li key={v.youtubeId}>
                <VideoCard video={v} />
              </li>
            ))}
          </ul>
        </section>
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
