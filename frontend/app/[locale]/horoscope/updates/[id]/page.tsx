import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { signInfo, spanLabel } from "@/lib/horoscopes";
import { edition as loadEdition } from "../../data";
import ReadingSections from "../../Reading";

export async function generateMetadata({ params }: PageProps<"/[locale]/horoscope/updates/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  return { title: t("specials") };
}

export default function UpdatePage({ params }: PageProps<"/[locale]/horoscope/updates/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Suspense fallback={<div className="h-96" />}>
        <Update params={params} />
      </Suspense>
    </div>
  );
}

async function Update({ params }: Pick<PageProps<"/[locale]/horoscope/updates/[id]">, "params">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const edition = await loadEdition(id, locale);
  if (!edition || (edition.period !== "festival" && edition.period !== "special")) notFound();
  const t = await getTranslations({ locale, namespace: "Horoscope" });

  return (
    <>
      <Link href="/horoscope" className="text-sm text-saffron hover:underline">
        ← {t("backToHoroscope")}
      </Link>
      <p className="mt-6 text-sm text-gold">
        {t(`kinds.${edition.period}`)} · {spanLabel("daily", edition.startsOn, locale)}
      </p>
      <h1 lang={edition.titleLocale ?? undefined} className="mt-2 font-serif text-4xl text-maroon">
        {edition.title}
      </h1>
      {edition.intro && (
        <p lang={edition.titleLocale ?? undefined} className="mt-4 whitespace-pre-line text-lg leading-relaxed">
          {edition.intro}
        </p>
      )}
      {edition.readings.length > 0 && (
        <div className="mt-8 space-y-3">
          {edition.readings.map((r) => (
            <details key={r.sign} className="group rounded-xl border border-gold/30 bg-warm-white">
              <summary className="flex cursor-pointer items-center gap-3 p-4">
                <span className="text-2xl text-saffron" aria-hidden>
                  {signInfo[r.sign].glyph}
                </span>
                <span className="font-serif text-xl text-maroon">{t(`signs.${r.sign}`)}</span>
                <span className="text-sm text-charcoal/60">{signInfo[r.sign].western}</span>
                <span className="ml-auto text-gold transition group-open:rotate-90" aria-hidden>
                  ›
                </span>
              </summary>
              <div className="border-t border-gold/20 p-4">
                <ReadingSections reading={r} />
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
