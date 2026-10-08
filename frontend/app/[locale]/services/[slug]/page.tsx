import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { durationLabel, priceLabel, requestHref } from "@/components/ServiceCard";
import { Link } from "@/i18n/navigation";
import { cloudinaryImage } from "@/lib/media";
import { getService } from "../data";

async function getCachedMeta(slug: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  try {
    const service = await getService(slug, locale);
    if (!service) return null;
    return {
      title: service.name,
      description: (service.summary ?? service.description)?.slice(0, 200) ?? undefined,
      openGraph: service.imageUrl ? { images: [cloudinaryImage(service.imageUrl, "c_fill,w_1200,h_630")] } : undefined,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = await getCachedMeta(slug, locale);
  if (meta) return meta;
  const t = await getTranslations({ locale, namespace: "Services" });
  return { title: t("title") };
}

export default function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Suspense fallback={<div className="h-96" />}>
        <ServiceDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ServiceDetails({ params }: Pick<PageProps<"/[locale]/services/[slug]">, "params">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const service = await getService(slug, locale);
  if (!service) notFound();
  const t = await getTranslations({ locale, namespace: "Services" });

  const facts = [
    [t("price"), priceLabel(t, service, locale)],
    service.durationMinutes ? [t("duration"), durationLabel(t, service.durationMinutes)] : null,
    service.modes.length ? [t("offered"), service.modes.map((m) => t(`modes.${m}`)).join(", ")] : null,
  ].filter((f) => f !== null);
  // Written by the admin in the service's own language
  const written = [
    [t("location"), service.location],
    [t("availability"), service.availability],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  const sections = [
    [t("about"), service.description],
    [t("purpose"), service.purpose],
    [t("requirements"), service.requirements],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.summary ?? service.description ?? undefined,
    serviceType: t(`${service.category}Title`),
    image: service.imageUrl ?? undefined,
    areaServed: "US",
    provider: { "@type": "Person", name: "Acharya Shantiram Koirala" },
    offers:
      service.priceCents !== null
        ? { "@type": "Offer", priceCurrency: "USD", price: (service.priceCents / 100).toFixed(2) }
        : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Link href="/services" className="text-sm text-saffron hover:underline">
        ← {t("allServices")}
      </Link>
      {service.locale !== locale && (
        <p className="mt-6 rounded-lg bg-cream p-4 text-sm">{t("otherLanguage", { language: t(`languages.${service.locale}`) })}</p>
      )}
      {service.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes it
        <img
          src={cloudinaryImage(service.imageUrl, "c_fill,w_1200,h_520")}
          alt=""
          className="mt-6 aspect-[12/5] w-full rounded-xl border border-gold/30 object-cover"
        />
      )}
      <p className="mt-6 text-sm text-gold">{t(`${service.category}Title`)}</p>
      <h1 className="mt-1 font-serif text-3xl text-maroon sm:text-4xl" lang={service.locale}>
        {service.name}
      </h1>
      {service.summary && (
        <p className="mt-3 text-lg leading-relaxed" lang={service.locale}>
          {service.summary}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-gold/30 bg-cream p-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-charcoal/60">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          {written.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-charcoal/60">{label}</dt>
              <dd className="font-medium" lang={service.locale}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 border-t border-gold/30 pt-4">
          {service.bookingOpen ? (
            <>
              <Link
                href={requestHref(service)}
                className="inline-block rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark"
              >
                {t("requestThis")}
              </Link>
              <p className="mt-2 text-sm text-charcoal/70">{t("requestNote")}</p>
            </>
          ) : (
            <p className="font-medium text-charcoal/70">{t("closed")}</p>
          )}
        </div>
      </div>

      {sections.map(([title, text]) => (
        <section key={title} className="mt-8">
          <h2 className="font-serif text-2xl text-maroon">{title}</h2>
          <div className="mt-3 whitespace-pre-line leading-relaxed" lang={service.locale}>
            {text}
          </div>
        </section>
      ))}
    </>
  );
}
