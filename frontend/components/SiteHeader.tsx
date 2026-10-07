import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

const navItems = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/services", key: "services" },
  { href: "/articles", key: "articles" },
  { href: "/events", key: "events" },
  { href: "/gallery", key: "gallery" },
  { href: "/books", key: "books" },
  { href: "/pravachan", key: "pravachan" },
  { href: "/horoscope", key: "horoscope" },
  { href: "/contact", key: "contact" },
] as const;

export default function SiteHeader() {
  const t = useTranslations("Nav");
  const site = useTranslations("Site");

  return (
    <header className="border-b border-gold/30 bg-warm-white/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-serif text-xl font-semibold tracking-wide text-maroon">
          {site("name")}
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className="hover:text-saffron">
              {t(item.key)}
            </Link>
          ))}
          {/* Pages with unknown paths (e.g. an article) read the path at request time */}
          <Suspense fallback={<span className="w-24" />}>
            <LanguageSwitcher />
          </Suspense>
          <Link
            href="/contact"
            className="rounded-full bg-saffron px-4 py-2 font-medium text-white hover:bg-saffron-dark"
          >
            {t("book")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
