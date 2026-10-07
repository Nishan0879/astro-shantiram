import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { type EventList, eventDay, timeRange } from "@/lib/events";
import { publicJson } from "@/lib/public-api";

export async function generateMetadata({ params }: PageProps<"/[locale]/events">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Events" });
  return { title: t("title"), description: t("intro") };
}

export default function EventsPage({ params, searchParams }: PageProps<"/[locale]/events">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Events");

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-40" />}>
        <EventListing locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EventListing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/events">["searchParams"];
}) {
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = await getTranslations({ locale, namespace: "Events" });
  const format = await getFormatter({ locale });

  const data = await publicJson<EventList>(`/api/events?${new URLSearchParams({ locale, when, page: String(page) })}`);
  const { events, total, pageSize } = data ?? { events: [], total: 0, pageSize: 12 };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (w: string, p = 1) => ({
    pathname: "/events" as const,
    query: { ...(w === "past" ? { when: "past" } : {}), ...(p > 1 ? { page: String(p) } : {}) },
  });

  return (
    <>
      <nav className="mt-8 flex gap-2 text-sm">
        {(["upcoming", "past"] as const).map((w) => (
          <Link
            key={w}
            href={href(w)}
            className={`rounded-full border px-4 py-1.5 ${
              w === when ? "border-saffron bg-saffron text-white" : "border-gold/40 hover:border-saffron"
            }`}
          >
            {t(w)}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <p className="mt-10 text-charcoal/70">{when === "past" ? t("emptyPast") : t("emptyUpcoming")}</p>
      ) : (
        <ul className="mt-10 space-y-5">
          {events.map((e) => {
            const day = eventDay(e.eventDate);
            const time = timeRange(e.startTime, e.endTime, locale);
            return (
              <li key={e.slug} className="flex gap-4 rounded-xl border border-gold/30 bg-cream p-5">
                <div className="w-16 shrink-0 self-start rounded-lg bg-maroon py-2 text-center text-cream">
                  <div className="text-2xl font-semibold">{format.dateTime(day, { day: "numeric", timeZone: "UTC" })}</div>
                  <div className="text-xs uppercase">{format.dateTime(day, { month: "short", timeZone: "UTC" })}</div>
                </div>
                <div className="min-w-0">
                  <h2 lang={e.locale} className="font-serif text-xl text-maroon">
                    <Link href={`/events/${e.slug}`} className="hover:text-saffron">
                      {e.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-charcoal/80">
                    {format.dateTime(day, { dateStyle: "full", timeZone: "UTC" })}
                    {time && ` · ${time} ${t("timeZoneShort")}`}
                  </p>
                  {e.location && <p lang={e.locale} className="text-sm text-charcoal/80">{e.location}</p>}
                  <Link href={`/events/${e.slug}`} className="mt-2 inline-block text-sm text-saffron hover:underline">
                    {t("details")} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-8 flex justify-between">
          {page > 1 ? <Link href={href(when, page - 1)} className="text-saffron hover:underline">← {t("previous")}</Link> : <span />}
          {page < pages ? <Link href={href(when, page + 1)} className="text-saffron hover:underline">{t("next")} →</Link> : <span />}
        </div>
      )}
    </>
  );
}
