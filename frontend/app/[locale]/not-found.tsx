import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-maroon">{t("title")}</h1>
      <p className="mt-4 text-charcoal/80">{t("text")}</p>
      <Link href="/" className="mt-8 inline-block rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
        {t("home")}
      </Link>
    </section>
  );
}
