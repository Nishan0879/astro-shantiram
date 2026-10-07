import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { galleryCategories, type GalleryList } from "@/lib/media";
import { publicJson } from "@/lib/public-api";
import GalleryGrid from "./GalleryGrid";

export async function generateMetadata({ params }: PageProps<"/[locale]/gallery">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Gallery" });
  return { title: t("title"), description: t("intro") };
}

export default function GalleryPage({ params, searchParams }: PageProps<"/[locale]/gallery">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Gallery");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-60" />}>
        <GalleryListing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function GalleryListing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/gallery">["searchParams"];
}) {
  const sp = await searchParams;
  const category = galleryCategories.find((c) => c === sp.category);
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations({ locale, namespace: "Gallery" });

  const query = new URLSearchParams({ locale, page: String(page) });
  if (category) query.set("category", category);
  const data = await publicJson<GalleryList>(`/api/gallery?${query}`);
  const { items, total, pageSize } = data ?? { items: [], total: 0, pageSize: 24 };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const href = (c?: string, p = 1) => ({
    pathname: "/gallery" as const,
    query: { ...(c ? { category: c } : {}), ...(p > 1 ? { page: String(p) } : {}) },
  });

  return (
    <>
      <nav className="mt-8 flex flex-wrap gap-2 text-sm">
        {[undefined, ...galleryCategories].map((c) => (
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

      {items.length === 0 ? (
        <p className="mt-10 text-charcoal/70">{t("empty")}</p>
      ) : (
        <GalleryGrid
          items={items}
          labels={{ close: t("close"), previous: t("previous"), next: t("next"), play: t("play") }}
        />
      )}

      {pages > 1 && (
        <div className="mt-8 flex justify-between">
          {page > 1 ? <Link href={href(category, page - 1)} className="text-saffron hover:underline">← {t("previous")}</Link> : <span />}
          {page < pages ? <Link href={href(category, page + 1)} className="text-saffron hover:underline">{t("next")} →</Link> : <span />}
        </div>
      )}
    </>
  );
}
