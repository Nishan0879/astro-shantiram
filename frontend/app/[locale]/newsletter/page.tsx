import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import NewsletterSignup from "@/components/NewsletterSignup";
import { confirmEmail } from "./actions";
import Unsubscribe from "./Unsubscribe";

export async function generateMetadata({ params }: PageProps<"/[locale]/newsletter">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Newsletter" });
  // The confirm and unsubscribe links carry personal keys, so keep search engines out
  return { title: t("title"), robots: { index: false } };
}

export default function NewsletterPage({ params, searchParams }: PageProps<"/[locale]/newsletter">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Newsletter");
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <div className="mt-8">
        <Suspense fallback={<div className="h-32" />}>
          <Body locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Body({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/newsletter">["searchParams"] }) {
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Newsletter" });
  const email = typeof sp.email === "string" ? sp.email : "";
  const key = typeof sp.key === "string" ? sp.key : "";

  if (sp.unsubscribe && email && key) return <Unsubscribe email={email} keyValue={key} />;
  if (sp.confirm && email && key) {
    let ok: boolean | null = null;
    try {
      ok = await confirmEmail(email, key);
    } catch (err) {
      console.error("Confirming newsletter failed", err);
      return <p className="rounded-lg bg-cream p-6 text-lg">{t("failed")}</p>;
    }
    return <p className="rounded-lg bg-cream p-6 text-lg">{ok ? t("confirmed") : t("badLink")}</p>;
  }
  return (
    <>
      <p className="mb-8 text-lg">{t("intro")}</p>
      <NewsletterSignup tone="light" />
    </>
  );
}
