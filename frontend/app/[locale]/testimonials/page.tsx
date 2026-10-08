import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, use } from "react";
import Stars from "@/components/Stars";
import TestimonialCard from "@/components/TestimonialCard";
import { publicJson } from "@/lib/public-api";
import type { TestimonialList } from "@/lib/testimonials";
import ReviewForm from "./ReviewForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/testimonials">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Testimonials" });
  return { title: t("title"), description: t("intro") };
}

export default function TestimonialsPage({ params }: PageProps<"/[locale]/testimonials">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Testimonials");
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-serif text-4xl text-maroon">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg">{t("intro")}</p>
      <Suspense fallback={<div className="mt-10 h-64" />}>
        <Reviews locale={locale} />
      </Suspense>
      <section id="share" className="mx-auto mt-16 max-w-2xl scroll-mt-8">
        <h2 className="font-serif text-3xl text-maroon">{t("shareTitle")}</h2>
        <p className="mt-2 mb-6">{t("shareText")}</p>
        <ReviewForm />
      </section>
    </div>
  );
}

async function Reviews({ locale }: { locale: string }) {
  // New approvals show up right away
  await connection();
  const t = await getTranslations({ locale, namespace: "Testimonials" });
  let data: TestimonialList | null = null;
  try {
    data = await publicJson<TestimonialList>("/api/testimonials?limit=100");
  } catch {
    // The form still works if the list cannot be loaded
  }
  if (!data?.testimonials.length) return <p className="mt-10 rounded-xl bg-cream p-6">{t("none")}</p>;
  const average = data.average ?? 0;
  return (
    <>
      <p className="mt-6 flex flex-wrap items-center gap-2">
        <Stars rating={Math.round(average)} label={t("stars", { rating: average })} className="text-2xl" />
        <span>{t("summary", { average: average.toLocaleString(locale === "en" ? "en-US" : locale), count: data.count })}</span>
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {data.testimonials.map((r) => (
          <TestimonialCard key={r.id} testimonial={r} />
        ))}
      </div>
    </>
  );
}
