import { useTranslations } from "next-intl";
import { facebookPageUrl, hasFacebookPage, youtubeChannelUrl } from "@/lib/site";

export default function SiteFooter() {
  const site = useTranslations("Site");
  const t = useTranslations("Footer");

  return (
    <footer className="bg-maroon-dark text-cream">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm">
        <p className="font-serif text-lg">{site("name")}</p>
        <p className="mt-1 text-gold">{site("tagline")}</p>
        <p className="mt-4 flex justify-center gap-6">
          <a href={youtubeChannelUrl} target="_blank" rel="noopener" className="hover:text-gold">
            {t("youtube")} ↗
          </a>
          {hasFacebookPage && (
            <a href={facebookPageUrl} target="_blank" rel="noopener" className="hover:text-gold">
              {t("facebook")} ↗
            </a>
          )}
        </p>
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
