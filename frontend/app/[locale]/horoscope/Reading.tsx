import { useTranslations } from "next-intl";
import { readingFields, type Reading } from "@/lib/horoscopes";

/** One sign's reading: the overview, then each topic Guruji wrote about. */
export default function ReadingSections({ reading }: { reading: Reading }) {
  const t = useTranslations("Horoscope.sections");
  return (
    <div lang={reading.locale} className="space-y-5">
      <p className="whitespace-pre-line text-lg leading-relaxed">{reading.overview}</p>
      {readingFields
        .filter((f) => f !== "overview" && f !== "lucky" && reading[f])
        .map((f) => (
          <section key={f}>
            <h3 className="font-serif text-xl text-maroon">{t(f)}</h3>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{reading[f]}</p>
          </section>
        ))}
      {reading.lucky && (
        <p className="inline-block rounded-full bg-cream px-4 py-2 text-sm">
          <span className="text-gold">✦ {t("lucky")}:</span> {reading.lucky}
        </p>
      )}
    </div>
  );
}
