import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { astrologyServices, pujaServices } from "@/lib/services";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return { title: t("title") };
}

export default function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Services");

  const groups = [
    { group: "astrology", title: t("astrologyTitle"), keys: astrologyServices },
    { group: "puja", title: t("pujaTitle"), keys: pujaServices },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      {groups.map(({ group, title, keys }) => (
        <section key={group} className="mt-12">
          <h2 className="font-serif text-2xl text-maroon">{title}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((key) => (
              <li key={key} className="flex items-center justify-between rounded-lg border border-gold/30 bg-cream p-4">
                <span>{t(`${group}.${key}`)}</span>
                <Link href="/contact" className="text-sm text-saffron hover:underline">
                  {t("request")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
