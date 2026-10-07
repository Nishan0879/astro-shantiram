import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, use } from "react";
import ZodiacGrid from "@/components/ZodiacGrid";
import { Link } from "@/i18n/navigation";
import { spanLabel } from "@/lib/horoscopes";
import { currentEdition, pickPeriod, specialEditions } from "./data";
import PeriodTabs from "./PeriodTabs";

export async function generateMetadata({ params }: PageProps<"/[locale]/horoscope">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  return { title: t("title"), description: t("intro") };
}

export default function HoroscopePage({ params, searchParams }: PageProps<"/[locale]/horoscope">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Horoscope");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-96" />}>
        <Selector locale={locale} searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <Specials locale={locale} />
      </Suspense>
    </div>
  );
}

async function Selector({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/horoscope">["searchParams"] }) {
  const period = pickPeriod((await searchParams).period);
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  const edition = await currentEdition(period, locale);

  return (
    <div className="mt-8">
      <PeriodTabs pathname="/horoscope" current={period} />
      <div className="mt-6 rounded-xl bg-cream p-4 text-sm">
        {edition ? (
          <>
            <p className="font-medium text-maroon">
              {t(`kinds.${period}`)} · {spanLabel(period, edition.startsOn, locale)}
            </p>
            {!edition.covers && <p className="mt-1 text-charcoal/70">{t("newest", { date: spanLabel(period, edition.startsOn, locale) })}</p>}
            {edition.intro && (
              <p lang={edition.titleLocale ?? undefined} className="mt-2 whitespace-pre-line">
                {edition.intro}
              </p>
            )}
          </>
        ) : (
          <p>{t("notWritten")}</p>
        )}
      </div>
      <h2 className="mt-8 font-serif text-2xl text-maroon">{t("chooseSign")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-charcoal/70">{t("howToChoose")}</p>
      <div className="mt-4">
        <ZodiacGrid period={period} />
      </div>
    </div>
  );
}

async function Specials({ locale }: { locale: string }) {
  // Read per visit, not once when the site is built
  await connection();
  const specials = await specialEditions(locale);
  if (specials.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  return (
    <section className="mt-14 border-t border-gold/30 pt-8">
      <h2 className="font-serif text-2xl text-maroon">{t("specials")}</h2>
      <ul className="mt-4 divide-y divide-gold/20">
        {specials.map((s) => (
          <li key={s.id}>
            <Link href={`/horoscope/updates/${s.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-saffron">
              <span lang={s.titleLocale} className="font-serif text-lg">
                {s.title}
              </span>
              <span className="shrink-0 text-sm text-charcoal/60">
                {t(`kinds.${s.period}`)} · {spanLabel("daily", s.startsOn, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
