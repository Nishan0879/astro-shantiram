import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import ZodiacGrid from "@/components/ZodiacGrid";
import { Link } from "@/i18n/navigation";
import { signInfo, spanLabel, zodiacSigns } from "@/lib/horoscopes";
import { currentEdition, pickPeriod } from "../data";
import PeriodTabs from "../PeriodTabs";
import ReadingSections from "../Reading";

const findSign = (value: string) => zodiacSigns.find((s) => s === value);

export async function generateMetadata({ params }: PageProps<"/[locale]/horoscope/[sign]">): Promise<Metadata> {
  const { locale, sign } = await params;
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  const found = findSign(sign);
  if (!found) return { title: t("title") };
  return { title: `${t(`signs.${found}`)} (${signInfo[found].western}) · ${t("title")}`, description: t("intro") };
}

export default function SignPage({ params, searchParams }: PageProps<"/[locale]/horoscope/[sign]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Suspense fallback={<div className="h-96" />}>
        <SignReading params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignReading({ params, searchParams }: Pick<PageProps<"/[locale]/horoscope/[sign]">, "params" | "searchParams">) {
  const { locale, sign: signParam } = await params;
  setRequestLocale(locale);
  const sign = findSign(signParam);
  if (!sign) notFound();
  const period = pickPeriod((await searchParams).period);
  const t = await getTranslations({ locale, namespace: "Horoscope" });
  const edition = await currentEdition(period, locale);
  const reading = edition?.readings.find((r) => r.sign === sign);
  const info = signInfo[sign];
  const signName = t(`signs.${sign}`);

  return (
    <>
      <Link href={{ pathname: "/horoscope", query: period === "daily" ? {} : { period } }} className="text-sm text-saffron hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-6 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-maroon text-4xl text-gold" aria-hidden>
          {info.glyph}
        </span>
        <div>
          <h1 className="font-serif text-4xl text-maroon">{signName}</h1>
          <p className="text-charcoal/70">{info.western}</p>
        </div>
      </div>

      <div className="mt-6">
        <PeriodTabs pathname={`/horoscope/${sign}`} current={period} />
      </div>

      <article className="mt-6 rounded-xl border border-gold/30 bg-warm-white p-5 sm:p-6">
        {edition ? (
          <>
            <p className="text-sm text-gold">
              {t(`kinds.${period}`)} · {spanLabel(period, edition.startsOn, locale)}
            </p>
            {!edition.covers && <p className="mt-1 text-sm text-charcoal/70">{t("newest", { date: spanLabel(period, edition.startsOn, locale) })}</p>}
            {edition.intro && (
              <p lang={edition.titleLocale ?? undefined} className="mt-3 whitespace-pre-line rounded-lg bg-cream p-3 text-sm">
                <span className="font-medium">{t("forAllSigns")}:</span> {edition.intro}
              </p>
            )}
            <div className="mt-5">
              {reading ? (
                <>
                  {reading.locale !== locale && (
                    <p className="mb-4 text-sm text-charcoal/70">{t("otherLanguage", { language: t(`languages.${reading.locale}`) })}</p>
                  )}
                  <ReadingSections reading={reading} />
                </>
              ) : (
                <p>{t("signNotWritten", { sign: signName })}</p>
              )}
            </div>
          </>
        ) : (
          <p>{t("notWritten")}</p>
        )}
      </article>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-maroon">{t("otherSigns")}</h2>
        <div className="mt-3">
          <ZodiacGrid period={period} compact />
        </div>
      </section>
    </>
  );
}
