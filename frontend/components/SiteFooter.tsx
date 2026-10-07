import { useTranslations } from "next-intl";

export default function SiteFooter() {
  const site = useTranslations("Site");
  const t = useTranslations("Footer");

  return (
    <footer className="bg-maroon-dark text-cream">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm">
        <p className="font-serif text-lg">{site("name")}</p>
        <p className="mt-1 text-gold">{site("tagline")}</p>
        <p className="mt-4 opacity-70">
          © <CurrentYear /> {site("name")}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}

async function CurrentYear() {
  "use cache";
  return new Date().getFullYear();
}
