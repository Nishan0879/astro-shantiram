import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cloudinaryImage } from "@/lib/media";
import { durationParts, formatPrice, type ServiceSummary } from "@/lib/services";

type ServicesT = ReturnType<typeof useTranslations<"Services">>;

/** "$151", "From $151" or "Ask for the price". */
export function priceLabel(t: ServicesT, service: Pick<ServiceSummary, "priceCents" | "priceFrom">, locale: string) {
  if (service.priceCents === null) return t("priceAsk");
  const price = formatPrice(service.priceCents, locale);
  return service.priceFrom ? t("priceFrom", { price }) : price;
}

/** "45 min", "2 hr" or "1 hr 30 min". */
export function durationLabel(t: ServicesT, minutes: number) {
  const { hours, minutes: rest } = durationParts(minutes);
  if (hours === 0) return t("durationMinutes", { minutes: rest });
  return rest === 0 ? t("durationHours", { hours }) : t("durationBoth", { hours, minutes: rest });
}

/** The booking page with this service already chosen. */
export function requestHref(service: Pick<ServiceSummary, "slug">) {
  return `/book?service=${encodeURIComponent(service.slug)}`;
}

export default function ServiceCard({ service }: { service: ServiceSummary }) {
  const t = useTranslations("Services");
  const locale = useLocale();
  const details = `/services/${service.slug}`;
  const facts = [priceLabel(t, service, locale), service.durationMinutes ? durationLabel(t, service.durationMinutes) : null].filter(Boolean);

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-gold/30 bg-warm-white">
      {service.imageUrl && (
        <Link href={details} tabIndex={-1} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes it */}
          <img src={cloudinaryImage(service.imageUrl, "c_fill,w_640,h_360")} alt="" className="aspect-video w-full object-cover" />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-xl text-maroon" lang={service.locale}>
          <Link href={details} className="hover:text-saffron">
            {service.name}
          </Link>
        </h3>
        {service.summary && (
          <p className="mt-2 text-sm leading-relaxed text-charcoal/80" lang={service.locale}>
            {service.summary}
          </p>
        )}
        <p className="mt-3 text-sm font-medium text-charcoal">{facts.join(" · ")}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
          <Link href={details} className="text-saffron-dark hover:underline">
            {t("learnMore")} →
          </Link>
          {service.bookingOpen ? (
            <Link href={requestHref(service)} className="rounded-full bg-saffron px-4 py-1.5 font-medium text-white hover:bg-saffron-dark">
              {t("request")}
            </Link>
          ) : (
            <span className="text-xs text-charcoal/60">{t("closed")}</span>
          )}
        </div>
      </div>
    </li>
  );
}
