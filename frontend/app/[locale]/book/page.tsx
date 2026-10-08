import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { durationLabel, priceLabel } from "@/components/ServiceCard";
import { Link } from "@/i18n/navigation";
import { serviceCategories, type ServiceSummary } from "@/lib/services";
import { getServices } from "../services/data";
import { loadAvailability } from "./actions";
import BookingFlow from "./BookingFlow";

export async function generateMetadata({ params }: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Booking" });
  return { title: t("title"), description: t("intro") };
}

export default function BookPage({ params, searchParams }: PageProps<"/[locale]/book">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Booking");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="h-96" />}>
        <Booking locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Booking({ locale, searchParams }: { locale: string } & Pick<PageProps<"/[locale]/book">, "searchParams">) {
  const { service: slug } = await searchParams;
  const services = (await getServices(locale)).filter((s) => s.bookingOpen);
  const service = typeof slug === "string" ? services.find((s) => s.slug === slug) : undefined;
  if (!service) return <ServicePicker services={services} />;

  const availability = await loadAvailability(service.slug);
  if (!availability) return <ServicePicker services={services} problem />;
  return (
    <>
      <ChosenService service={service} />
      <BookingFlow key={service.slug} service={service} initial={availability} />
    </>
  );
}

function ChosenService({ service }: { service: ServiceSummary }) {
  const t = useTranslations("Booking");
  const s = useTranslations("Services");
  const locale = useLocale();
  const facts = [priceLabel(s, service, locale), service.durationMinutes ? durationLabel(s, service.durationMinutes) : null].filter(Boolean);
  return (
    <div className="mt-8 flex items-start justify-between gap-4 rounded-xl border border-gold/30 bg-cream p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-charcoal/60">{t("chosen")}</p>
        <p className="font-serif text-xl text-maroon" lang={service.locale}>
          {service.name}
        </p>
        <p className="text-sm">{facts.join(" · ")}</p>
      </div>
      <Link href="/book" className="shrink-0 text-sm text-saffron-dark hover:underline">
        {t("change")}
      </Link>
    </div>
  );
}

function ServicePicker({ services, problem = false }: { services: ServiceSummary[]; problem?: boolean }) {
  const t = useTranslations("Booking");
  const s = useTranslations("Services");
  return (
    <>
      {problem && <p className="mt-6 rounded bg-red-50 p-3 text-sm text-red-800">{t("problems.failed")}</p>}
      <h2 className="mt-10 font-serif text-2xl text-maroon">{t("chooseService")}</h2>
      {services.length === 0 && <p className="mt-4 text-charcoal/70">{s("empty")}</p>}
      {serviceCategories.map((category) => {
        const list = services.filter((x) => x.category === category);
        if (list.length === 0) return null;
        return (
          <section key={category} className="mt-6">
            <h3 className="font-medium text-gold">{s(`${category}Title`)}</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {list.map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/book?service=${x.slug}`}
                    lang={x.locale}
                    className="block rounded-lg border border-gold/30 bg-warm-white px-4 py-3 hover:border-saffron hover:bg-cream"
                  >
                    {x.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
