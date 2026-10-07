import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { articleCategories, type ArticleList } from "@/lib/articles";
import { publicJson } from "@/lib/public-api";

export async function generateMetadata({ params }: PageProps<"/[locale]/articles">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Articles" });
  return { title: t("title"), description: t("intro") };
}

export default function ArticlesPage({ params, searchParams }: PageProps<"/[locale]/articles">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Articles");

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-40" />}>
        <ArticleListing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ArticleListing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/articles">["searchParams"];
}) {
  const sp = await searchParams;
  const category = articleCategories.find((c) => c === sp.category);
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations({ locale, namespace: "Articles" });
  const format = await getFormatter({ locale });

  const query = new URLSearchParams({ locale, page: String(page) });
  if (category) query.set("category", category);
  const data = await publicJson<ArticleList>(`/api/articles?${query}`);
  const { articles, total, pageSize } = data ?? { articles: [], total: 0, pageSize: 12 };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const href = (c?: string, p = 1) => ({
    pathname: "/articles" as const,
    query: { ...(c ? { category: c } : {}), ...(p > 1 ? { page: String(p) } : {}) },
  });

  return (
    <>
      <nav className="mt-8 flex flex-wrap gap-2 text-sm">
        {[undefined, ...articleCategories].map((c) => (
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

      {articles.length === 0 ? (
        <p className="mt-10 text-charcoal/70">{t("empty")}</p>
      ) : (
        <ul className="mt-10 space-y-6">
          {articles.map((a) => (
            <li key={a.slug} className="rounded-xl border border-gold/30 bg-cream p-6">
              <p className="text-sm text-gold">
                {t(`categories.${a.category}`)} · {format.dateTime(new Date(a.publishedAt), { dateStyle: "long" })}
              </p>
              <h2 lang={a.locale} className="mt-2 font-serif text-2xl text-maroon">
                <Link href={`/articles/${a.slug}`} className="hover:text-saffron">
                  {a.title}
                </Link>
              </h2>
              {a.summary && <p lang={a.locale} className="mt-2">{a.summary}</p>}
              <Link href={`/articles/${a.slug}`} className="mt-3 inline-block text-saffron hover:underline">
                {t("readMore")} →
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-8 flex justify-between">
          {page > 1 ? <Link href={href(category, page - 1)} className="text-saffron hover:underline">← {t("newer")}</Link> : <span />}
          {page < pages ? <Link href={href(category, page + 1)} className="text-saffron hover:underline">{t("older")} →</Link> : <span />}
        </div>
      )}
    </>
  );
}
