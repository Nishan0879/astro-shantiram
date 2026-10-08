"use client";

import { useTranslations } from "next-intl";

// Shown when a page fails to load, for example while the API is briefly unreachable
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("PageError");
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-maroon">{t("title")}</h1>
      <p className="mt-4 text-charcoal/80">{t("text")}</p>
      <button type="button" onClick={reset} className="mt-8 rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
        {t("retry")}
      </button>
    </section>
  );
}
