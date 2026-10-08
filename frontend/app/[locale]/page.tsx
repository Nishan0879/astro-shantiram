import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, use } from "react";
import VideoCard from "@/components/VideoCard";
import ZodiacGrid from "@/components/ZodiacGrid";
import { Link } from "@/i18n/navigation";
import type { PublicEdition } from "@/lib/horoscopes";
import { publicJson } from "@/lib/public-api";
import { serviceCategories, type ServiceSummary } from "@/lib/services";
import { facebookFeedUrl, facebookPageUrl, youtubeChannelUrl } from "@/lib/site";
import type { VideoList } from "@/lib/videos";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");
  const site = useTranslations("Site");

  return (
    <>
      <section className="bg-mandala bg-maroon text-cream">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p className="font-serif text-lg text-gold">{t("verse")}</p>
          <h1 className="mt-6 font-serif text-4xl font-semibold sm:text-5xl">{site("guru")}</h1>
          <p className={`mt-3 text-gold ${locale === "en" ? "tracking-widest" : ""}`}>{site("tagline")}</p>
          <p className="mx-auto mt-6 max-w-xl text-lg opacity-90">{t("intro")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/book" className="rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark">
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
          <Suspense fallback={<div className="mt-10 h-72" />}>
            <ServiceColumns locale={locale} />
          </Suspense>
          <div className="mt-8 text-center">
            <Link href="/services" className="text-saffron hover:underline">
              {t("allServices")} →
            </Link>
          </div>
        </div>
      </section>

      <Suspense>
        <TodaysHoroscope locale={locale} />
      </Suspense>

      <Suspense>
        <LatestPravachan locale={locale} />
      </Suspense>

      <FacebookUpdates />

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

async function ServiceColumns({ locale }: { locale: string }) {
  // Load the list for each visit, so changes in the admin show up right away
  await connection();
  let services: ServiceSummary[] = [];
  try {
    services = (await publicJson<{ services: ServiceSummary[] }>(`/api/services?locale=${locale}`))?.services ?? [];
  } catch {
    // The home page still works if the list cannot be loaded
  }
  if (services.length === 0) return null;
  return <ServiceColumnList services={services} />;
}

function ServiceColumnList({ services }: { services: ServiceSummary[] }) {
  const t = useTranslations("Home");
  return (
    <div className="mt-10 grid gap-8 md:grid-cols-2">
      {serviceCategories.map((category) => (
        <div key={category} className="rounded-xl border border-gold/30 bg-warm-white p-6">
          <h3 className="font-serif text-2xl text-maroon">
            <Link href={`/services#${category}`} className="hover:text-saffron">
              {t(`${category}Title`)}
            </Link>
          </h3>
          <ul className="mt-4 space-y-2">
            {services
              .filter((s) => s.category === category)
              .slice(0, 6)
              .map((s) => (
                <li key={s.slug} className="flex gap-2">
                  <span className="text-gold">✦</span>
                  <Link href={`/services/${s.slug}`} lang={s.locale} className="hover:text-saffron">
                    {s.name}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

async function latestVideos(locale: string) {
  try {
    return (await publicJson<VideoList>(`/api/videos?locale=${locale}&limit=3`))?.videos ?? [];
  } catch {
    // The home page still works if the video list cannot be loaded
    return [];
  }
}

async function LatestPravachan({ locale }: { locale: string }) {
  // Load the list for each visit, not once when the site is built
  await connection();
  const videos = await latestVideos(locale);
  if (videos.length === 0) return null;
  return <LatestPravachanList videos={videos} />;
}

function LatestPravachanList({ videos }: { videos: VideoList["videos"] }) {
  const t = useTranslations("Home");
  const p = useTranslations("Pravachan");
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-center font-serif text-3xl text-maroon">{t("latestTitle")}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-center">{t("latestText")}</p>
      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <li key={v.youtubeId}>
            <VideoCard video={v} />
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link href="/pravachan" className="text-saffron hover:underline">
          {t("allVideos")} →
        </Link>
        <a href={youtubeChannelUrl} target="_blank" rel="noopener" className="text-saffron hover:underline">
          {p("subscribe")} ↗
        </a>
      </div>
    </section>
  );
}

/** Facebook's own embedded feed, so the page needs no Facebook app or access token. */
function FacebookUpdates() {
  const t = useTranslations("Home");
  const feed = facebookFeedUrl(500);
  if (!feed) return null;
  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-serif text-3xl text-maroon">{t("facebookTitle")}</h2>
        <iframe
          src={feed}
          title={t("facebookTitle")}
          loading="lazy"
          className="mx-auto mt-8 h-[600px] w-full max-w-[500px] rounded-xl border border-gold/30 bg-white"
          allow="encrypted-media; web-share"
        />
        <a href={facebookPageUrl} target="_blank" rel="noopener" className="mt-6 inline-block text-saffron hover:underline">
          {t("facebookLink")} ↗
        </a>
      </div>
    </section>
  );
}

/** The sign picker, once Guruji has written a daily horoscope. */
async function TodaysHoroscope({ locale }: { locale: string }) {
  await connection();
  let edition: PublicEdition | null = null;
  try {
    edition = (await publicJson<{ edition: PublicEdition | null }>(`/api/horoscopes/current?period=daily&locale=${locale}`))?.edition ?? null;
  } catch {
    // The home page still works if horoscopes cannot be loaded
  }
  if (!edition) return null;
  return <HoroscopeSection />;
}

function HoroscopeSection() {
  const t = useTranslations("Home");
  const h = useTranslations("Horoscope");
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h2 className="font-serif text-3xl text-maroon">{t("horoscopeTitle")}</h2>
      <p className="mx-auto mt-4 max-w-2xl">{t("horoscopeText")}</p>
      <div className="mt-8">
        <ZodiacGrid compact />
      </div>
      <Link href="/horoscope" className="mt-6 inline-block text-saffron hover:underline">
        {h("title")} →
      </Link>
    </section>
  );
}
