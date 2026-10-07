import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { calendarPeriods, type CalendarPeriod } from "@/lib/horoscopes";

/** Today / This week / This month / This year, keeping the visitor on the same page. */
export default function PeriodTabs({ pathname, current }: { pathname: string; current: CalendarPeriod }) {
  const t = useTranslations("Horoscope.periods");
  return (
    <nav className="flex gap-1 rounded-full bg-cream p-1 text-sm">
      {calendarPeriods.map((p) => (
        <Link
          key={p}
          href={{ pathname, query: p === "daily" ? {} : { period: p } }}
          aria-current={p === current ? "page" : undefined}
          className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-center sm:px-4 ${p === current ? "bg-saffron text-white" : "hover:bg-gold/20"}`}
        >
          {t(p)}
        </Link>
      ))}
    </nav>
  );
}
