import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { calendarDate, type CalendarPeriod, signInfo, zodiacSigns } from "@/lib/horoscopes";

const monthDay = (mmdd: string, locale: string) =>
  calendarDate(`2001-${mmdd}`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });

/** The twelve rashis, each opening that sign's reading. */
export default function ZodiacGrid({ period, compact = false }: { period?: CalendarPeriod; compact?: boolean }) {
  const t = useTranslations("Horoscope");
  const locale = useLocale();
  return (
    <ul className={`grid gap-2 ${compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`}>
      {zodiacSigns.map((sign) => {
        const info = signInfo[sign];
        return (
          <li key={sign}>
            <Link
              href={{ pathname: `/horoscope/${sign}`, query: period && period !== "daily" ? { period } : {} }}
              className="flex h-full flex-col items-center rounded-xl border border-gold/30 bg-warm-white px-1 py-3 text-center hover:border-saffron hover:bg-cream"
            >
              <span className={`leading-none text-saffron ${compact ? "text-2xl" : "text-3xl"}`} aria-hidden>
                {info.glyph}
              </span>
              <span className={`mt-2 font-serif text-maroon ${compact ? "text-sm" : ""}`}>{t(`signs.${sign}`)}</span>
              {!compact && (
                <>
                  <span className="text-xs text-charcoal/70">{info.western}</span>
                  <span className="mt-1 text-[11px] leading-tight text-charcoal/60">
                    {monthDay(info.from, locale)} – {monthDay(info.to, locale)}
                  </span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
