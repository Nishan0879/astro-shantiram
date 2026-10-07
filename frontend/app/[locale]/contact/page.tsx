import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import ContactForm from "./ContactForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("title") };
}

export default function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Contact");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 mb-8 text-lg">{t("intro")}</p>
      <ContactForm />
    </div>
  );
}
