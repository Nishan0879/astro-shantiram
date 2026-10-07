import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import Markdown from "react-markdown";
import { Link } from "@/i18n/navigation";
import { eventDay, type PublicEvent, timeRange } from "@/lib/events";
import { publicJson } from "@/lib/public-api";

async function getEvent(slug: string, locale: string) {
  const data = await publicJson<{ event: PublicEvent }>(`/api/events/${encodeURIComponent(slug)}?locale=${locale}`);
  return data?.event ?? null;
}

async function getCachedName(slug: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  try {
    return (await getEvent(slug, locale))?.name ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/events/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const name = await getCachedName(slug, locale);
  if (name) return { title: name };
  const t = await getTranslations({ locale, namespace: "Events" });
  return { title: t("title") };
}

export default function EventPage({ params }: PageProps<"/[locale]/events/[slug]">) {
  // The slug is only known at request time, so params are read inside Suspense
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Suspense fallback={<div className="h-80" />}>
        <EventDetails params={params} />
      </Suspense>
    </div>
  );
}

const buttonClass = "rounded-full px-5 py-2.5 font-medium";

async function EventDetails({ params }: Pick<PageProps<"/[locale]/events/[slug]">, "params">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const event = await getEvent(slug, locale);
  if (!event) notFound();
  const t = await getTranslations({ locale, namespace: "Events" });
  const format = await getFormatter({ locale });
  const time = timeRange(event.startTime, event.endTime, locale);

  return (
    <>
      <Link href={event.isPast ? { pathname: "/events", query: { when: "past" } } : "/events"} className="text-sm text-saffron hover:underline">
        ← {t("back")}
      </Link>
      {event.locale !== locale && (
        <p className="mt-6 rounded-lg bg-cream p-4 text-sm">
          {t("otherLanguage", { language: t(`languages.${event.locale}`) })}
        </p>
      )}
      <article lang={event.locale} className="mt-6">
        <h1 className="font-serif text-4xl text-maroon">{event.name}</h1>
        <dl className="mt-4 space-y-1 text-lg">
          <dd>{format.dateTime(eventDay(event.eventDate), { dateStyle: "full", timeZone: "UTC" })}</dd>
          {time && (
            <dd>
              {time} <span className="text-sm text-charcoal/60">({t("localTime")})</span>
            </dd>
          )}
          {event.location && <dd>{event.location}</dd>}
        </dl>

        {event.isPast ? (
          <p className="mt-6 rounded-lg bg-cream p-4">{t("pastNote")}</p>
        ) : (
          (event.registrationUrl || event.zoomUrl) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {event.registrationUrl && (
                <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} bg-saffron text-white hover:bg-saffron-dark`}>
                  {t("register")}
                </a>
              )}
              {event.zoomUrl && (
                <a href={event.zoomUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} border border-gold hover:border-saffron`}>
                  {t("zoom")}
                </a>
              )}
            </div>
          )
        )}
        {event.youtubeUrl && (
          <a href={event.youtubeUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-saffron hover:underline">
            {t("youtube")} ↗
          </a>
        )}

        {event.description && (
          <div className="article-body mt-8">
            <Markdown>{event.description}</Markdown>
          </div>
        )}
      </article>
    </>
  );
}
