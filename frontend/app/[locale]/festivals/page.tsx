import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { daysBetween, festivalKinds, type FestivalKind, type FestivalYear, kindClass } from "@/lib/festivals";
import { publicJson } from "@/lib/public-api";

export async function generateMetadata({ params }: PageProps<"/[locale]/festivals">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Festivals" });
  return { title: t("title"), description: t("intro") };
}

export default function FestivalsPage({ params, searchParams }: PageProps<"/[locale]/festivals">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Festivals");
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-96" />}>
        <Calendar locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Entry = {
  key: string;
  date: string;
  endDate: string | null;
  kind: FestivalKind | "event";
  name: string;
  description: string | null;
  locale: string;
  href: string | null;
  bookSlug: string | null;
  time: string | null;
};

async function Calendar({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/festivals">["searchParams"] }) {
  const sp = await searchParams;
  const requested = Number(sp.year);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : undefined;
  const kind = [...festivalKinds, "event"].find((k) => k === sp.kind) as FestivalKind | "event" | undefined;
  const t = await getTranslations({ locale, namespace: "Festivals" });

  const data = await publicJson<FestivalYear>(`/api/festivals?${new URLSearchParams({ locale, ...(year ? { year: String(year) } : {}) })}`);
  if (!data) return <p className="mt-10 text-charcoal/70">{t("failed")}</p>;

  const entries: Entry[] = [
    ...data.festivals.map((f) => ({
      key: f.id,
      date: f.date,
      endDate: f.endDate,
      kind: f.kind,
      name: f.name,
      description: f.description,
      locale: f.locale,
      href: null,
      bookSlug: f.serviceSlug,
      time: null,
    })),
    ...data.events.map((e) => ({
      key: `event-${e.slug}`,
      date: e.date,
      endDate: null,
      kind: "event" as const,
      name: e.name,
      description: null,
      locale: e.locale,
      href: `/events/${e.slug}`,
      bookSlug: null,
      time: e.startTime,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const shown = kind ? entries.filter((e) => e.kind === kind) : entries;
  const kindsPresent = new Set(entries.map((e) => e.kind));

  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, { ...opts, timeZone: "UTC" });
  const monthFormat = fmt({ month: "long", year: "numeric" });
  const dayFormat = fmt({ day: "numeric" });
  const weekdayFormat = fmt({ weekday: "short" });
  const shortFormat = fmt({ month: "short", day: "numeric" });
  const timeFormat = fmt({ hour: "numeric", minute: "2-digit" });
  const at = (date: string, time = "12:00") => new Date(`${date}T${time}:00Z`);

  const byMonth = new Map<string, Entry[]>();
  for (const e of shown) {
    // A festival that started last year shows under January
    const month = e.date.slice(0, 4) === String(data.year) ? e.date.slice(0, 7) : `${data.year}-01`;
    byMonth.set(month, [...(byMonth.get(month) ?? []), e]);
  }
  const next = entries.find((e) => (e.endDate ?? e.date) >= data.today);
  const yearHref = (y: number) => ({ pathname: "/festivals" as const, query: { year: String(y), ...(kind ? { kind } : {}) } });
  const kindHref = (k?: string) => ({ pathname: "/festivals" as const, query: { ...(year ? { year: String(year) } : {}), ...(k ? { kind: k } : {}) } });

  const countdown = (e: Entry) => {
    const days = daysBetween(data.today, e.date);
    if (days > 0) return t("inDays", { count: days });
    if (days === 0) return t("today");
    return t("underway");
  };

  return (
    <>
      <div className="mt-8 flex items-center justify-between gap-3">
        <Link href={yearHref(data.year - 1)} className="rounded-full border border-gold/40 px-4 py-2 text-sm hover:border-saffron">
          ← {data.year - 1}
        </Link>
        <p className="font-serif text-2xl text-maroon">{data.year}</p>
        <Link href={yearHref(data.year + 1)} className="rounded-full border border-gold/40 px-4 py-2 text-sm hover:border-saffron">
          {data.year + 1} →
        </Link>
      </div>

      {next && data.year === Number(data.today.slice(0, 4)) && !kind && (
        <div className="mt-6 rounded-xl border border-saffron/40 bg-cream p-5">
          <p className="text-xs uppercase tracking-wide text-saffron-dark">{t("next")}</p>
          <p lang={next.locale} className="mt-1 font-serif text-2xl text-maroon">
            {next.name}
          </p>
          <p className="mt-1">
            {fmt({ dateStyle: "full" }).format(at(next.date))} · <strong>{countdown(next)}</strong>
          </p>
        </div>
      )}

      {kindsPresent.size > 1 && (
        <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={t("filter")}>
          {[undefined, ...[...festivalKinds, "event" as const].filter((k) => kindsPresent.has(k))].map((k) => (
            <Link
              key={k ?? "all"}
              href={kindHref(k)}
              className={`rounded-full border px-3 py-1 ${k === kind ? "border-saffron bg-saffron text-white" : "border-gold/40 hover:border-saffron"}`}
            >
              {k ? t(`kinds.${k}`) : t("all")}
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 && <p className="mt-10 text-charcoal/70">{t("empty", { year: data.year })}</p>}

      {[...byMonth].map(([month, list]) => (
        <section key={month} className="mt-10">
          <h2 className="border-b border-gold/30 pb-2 font-serif text-2xl text-maroon">{monthFormat.format(at(`${month}-01`))}</h2>
          <ul className="mt-2 divide-y divide-gold/20">
            {list.map((e) => {
              const past = (e.endDate ?? e.date) < data.today;
              return (
                <li key={e.key} className={`flex gap-4 py-4 ${past ? "opacity-60" : ""}`}>
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-xs uppercase text-charcoal/60">{weekdayFormat.format(at(e.date))}</p>
                    <p className="font-serif text-3xl leading-none text-maroon">{dayFormat.format(at(e.date))}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.href ? (
                        <Link href={e.href} lang={e.locale} className="font-medium text-maroon hover:text-saffron">
                          {e.name}
                        </Link>
                      ) : (
                        <span lang={e.locale} className="font-medium text-maroon">
                          {e.name}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${kindClass[e.kind]}`}>{t(`kinds.${e.kind}`)}</span>
                    </div>
                    {(e.endDate || e.time) && (
                      <p className="mt-0.5 text-sm text-charcoal/70">
                        {e.endDate && t("until", { date: shortFormat.format(at(e.endDate)) })}
                        {e.time && `${timeFormat.format(at(e.date, e.time))} ${t("central")}`}
                      </p>
                    )}
                    {e.description && (
                      <p lang={e.locale} className="mt-1 whitespace-pre-line text-sm text-charcoal/80">
                        {e.description}
                      </p>
                    )}
                    {e.bookSlug && !past && (
                      <Link href={`/book?service=${e.bookSlug}`} className="mt-2 inline-block text-sm text-saffron-dark hover:underline">
                        {t("bookPuja")} →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-sm text-charcoal/60">{t("note")}</p>
    </>
  );
}
