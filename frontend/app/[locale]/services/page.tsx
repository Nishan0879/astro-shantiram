import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, use } from "react";
import ServiceCard from "@/components/ServiceCard";
import { serviceCategories, type ServiceSummary } from "@/lib/services";
import { getServices } from "./data";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return { title: t("title"), description: t("intro") };
}

export default function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Services");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="h-96" />}>
        <ServiceGroups locale={locale} />
      </Suspense>
    </div>
  );
}

async function ServiceGroups({ locale }: { locale: string }) {
  // Prices and services change in the admin, so load them for each visit
  await connection();
  const services = await getServices(locale);
  return <Groups services={services} />;
}

function Groups({ services }: { services: ServiceSummary[] }) {
  const t = useTranslations("Services");
  if (services.length === 0) return <p className="mt-12 text-charcoal/70">{t("empty")}</p>;

  return serviceCategories.map((category) => {
    const list = services.filter((s) => s.category === category);
    if (list.length === 0) return null;
    return (
      <section key={category} id={category} className="mt-12 scroll-mt-24">
        <h2 className="font-serif text-2xl text-maroon">{t(`${category}Title`)}</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </ul>
      </section>
    );
  });
}
