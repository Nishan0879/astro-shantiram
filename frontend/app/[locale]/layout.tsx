import type { Metadata } from "next";
import {
  Noto_Sans_Devanagari,
  Noto_Serif_Devanagari,
  Playfair_Display,
} from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "../globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});
const devanagariSans = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-devanagari-sans",
});
const devanagariSerif = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari-serif",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Site" });
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("name"), template: `%s | ${t("name")}` },
    description: t("description"),
    openGraph: { type: "website", siteName: t("name"), locale: { en: "en_US", ne: "ne_NP", sa: "sa_IN" }[locale] },
    twitter: { card: "summary" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${playfair.variable} ${devanagariSans.variable} ${devanagariSerif.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
