import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { astrologyServices, pujaServices } from "@/lib/services";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");
  const site = useTranslations("Site");
  const s = useTranslations("Services");

  return (
    <>
      <section className="bg-mandala bg-maroon text-cream">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="font-serif text-lg text-gold">{t("verse")}</p>
          <h1 className="mt-6 font-serif text-4xl font-semibold sm:text-5xl">{site("guru")}</h1>
          <p className={`mt-3 text-gold ${locale === "en" ? "tracking-widest" : ""}`}>{site("tagline")}</p>
          <p className="mx-auto mt-6 max-w-xl text-lg opacity-90">{t("intro")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
              {t("ctaBook")}
            </Link>
            <Link href="/services" className="rounded-full border border-gold px-6 py-3 font-medium text-cream hover:bg-gold/20">
              {t("ctaServices")}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="font-serif text-3xl text-maroon">{t("aboutTitle")}</h2>
        <p className="mt-4 text-lg">{t("aboutText")}</p>
        <Link href="/about" className="mt-6 inline-block text-saffron hover:underline">
          {t("aboutLink")} →
        </Link>
      </section>

      <section className="bg-cream">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center font-serif text-3xl text-maroon">{t("servicesTitle")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center">{t("servicesText")}</p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {[
              { title: t("astrologyTitle"), keys: astrologyServices.slice(0, 6), group: "astrology" },
              { title: t("pujaTitle"), keys: pujaServices.slice(0, 6), group: "puja" },
            ].map((col) => (
              <div key={col.group} className="rounded-xl border border-gold/30 bg-warm-white p-6">
                <h3 className="font-serif text-2xl text-maroon">{col.title}</h3>
                <ul className="mt-4 space-y-2">
                  {col.keys.map((key) => (
                    <li key={key} className="flex gap-2">
                      <span className="text-gold">✦</span>
                      {s(`${col.group}.${key}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/services" className="text-saffron hover:underline">
              {t("allServices")} →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="font-serif text-3xl text-maroon">{t("contactTitle")}</h2>
        <p className="mt-4">{t("contactText")}</p>
        <Link href="/contact" className="mt-6 inline-block rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
          {t("contactButton")}
        </Link>
      </section>
    </>
  );
}
