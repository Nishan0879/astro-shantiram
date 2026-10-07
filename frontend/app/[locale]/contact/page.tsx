import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { inquiryCategories } from "@/lib/services";
import ContactForm from "./ContactForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("title") };
}

export default function ContactPage({ params, searchParams }: PageProps<"/[locale]/contact">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Contact");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 mb-8 text-lg">{t("intro")}</p>
      <Suspense fallback={<ContactForm />}>
        <PrefilledForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** A service's request button opens this page with the inquiry type and subject filled in. */
async function PrefilledForm({ searchParams }: Pick<PageProps<"/[locale]/contact">, "searchParams">) {
  const { category, subject } = await searchParams;
  const known = inquiryCategories.find((c) => c === category);
  return <ContactForm category={known} subject={typeof subject === "string" ? subject.slice(0, 200) : undefined} />;
}
