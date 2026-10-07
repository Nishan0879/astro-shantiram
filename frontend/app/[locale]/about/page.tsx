import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

const sections = ["journey", "education", "astrology", "service", "mission"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return { title: t("title") };
}

export default function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("About");
  const site = useTranslations("Site");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-2 text-lg text-gold">{site("guru")}</p>
      <p className="mt-8 italic opacity-70">{t("placeholder")}</p>
      {sections.map((key) => (
        <section key={key} className="mt-10">
          <h2 className="font-serif text-2xl text-maroon">{t(`sections.${key}`)}</h2>
          <div className="mt-3 h-16 rounded bg-cream" />
        </section>
      ))}
    </div>
  );
}
