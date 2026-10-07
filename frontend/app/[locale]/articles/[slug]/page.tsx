import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import Markdown from "react-markdown";
import { Link } from "@/i18n/navigation";
import type { PublicArticle } from "@/lib/articles";
import { publicJson } from "@/lib/public-api";

async function getArticle(slug: string, locale: string) {
  const data = await publicJson<{ article: PublicArticle }>(
    `/api/articles/${encodeURIComponent(slug)}?locale=${locale}`,
  );
  return data?.article ?? null;
}

async function getCachedTitle(slug: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  try {
    const article = await getArticle(slug, locale);
    return article ? { title: article.title, description: article.summary ?? undefined } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/articles/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = await getCachedTitle(slug, locale);
  if (meta) return meta;
  const t = await getTranslations({ locale, namespace: "Articles" });
  return { title: t("title") };
}

export default function ArticlePage({ params }: PageProps<"/[locale]/articles/[slug]">) {
  // The slug is only known at request time, so params are read inside Suspense
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Suspense fallback={<div className="h-80" />}>
        <ArticleBody params={params} />
      </Suspense>
    </div>
  );
}

async function ArticleBody({ params }: Pick<PageProps<"/[locale]/articles/[slug]">, "params">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await getArticle(slug, locale);
  if (!article) notFound();
  const t = await getTranslations({ locale, namespace: "Articles" });
  const format = await getFormatter({ locale });

  return (
    <>
      <Link href="/articles" className="text-sm text-saffron hover:underline">
        ← {t("back")}
      </Link>
      {article.locale !== locale && (
        <p className="mt-6 rounded-lg bg-cream p-4 text-sm">
          {t("otherLanguage", { language: t(`languages.${article.locale}`) })}
        </p>
      )}
      <article lang={article.locale} className="mt-6">
        <p className="text-sm text-gold">
          {t(`categories.${article.category}`)} ·{" "}
          {format.dateTime(new Date(article.publishedAt), { dateStyle: "long" })}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-maroon">{article.title}</h1>
        {article.summary && <p className="mt-4 text-lg text-charcoal/80">{article.summary}</p>}
        <div className="article-body mt-8">
          <Markdown>{article.body}</Markdown>
        </div>
      </article>
    </>
  );
}
