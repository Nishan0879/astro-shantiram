import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { Link } from "@/i18n/navigation";
import { siteUrl } from "@/lib/site";
import { loadBooking } from "./actions";
import ManageBooking from "./ManageBooking";

export async function generateMetadata({ params }: PageProps<"/[locale]/book/manage">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ManageBooking" });
  // Personal pages reached from an email link stay out of search engines
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function ManagePage({ params, searchParams }: PageProps<"/[locale]/book/manage">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("ManageBooking");
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <Suspense fallback={<div className="h-96" />}>
        <Booking locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Booking({ locale, searchParams }: { locale: string } & Pick<PageProps<"/[locale]/book/manage">, "searchParams">) {
  const { ref, key } = await searchParams;
  const booking = typeof ref === "string" && typeof key === "string" ? await loadBooking(ref, key) : null;
  if (!booking) return <NotFound />;
  const pageUrl = `${siteUrl}/${locale}/book/manage?${new URLSearchParams({ ref: booking.reference, key: key as string })}`;
  return <ManageBooking initial={booking} manageKey={key as string} pageUrl={pageUrl} />;
}

function NotFound() {
  const t = useTranslations("ManageBooking");
  return (
    <div className="mt-8 rounded-xl border border-gold/30 bg-cream p-6">
      <h2 className="font-serif text-2xl text-maroon">{t("invalidTitle")}</h2>
      <p className="mt-3">{t("invalidText")}</p>
      <Link href="/contact" className="mt-6 inline-block rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
        {t("contact")}
      </Link>
    </div>
  );
}
