import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { zodiacSigns } from "@/lib/horoscopes";
import { publicJson } from "@/lib/public-api";
import type { ServiceSummary } from "@/lib/services";
import { siteUrl } from "@/lib/site";

const sections = ["", "/about", "/services", "/book", "/horoscope", "/articles", "/events", "/festivals", "/books", "/pravachan", "/gallery", "/testimonials", "/contact"];

/** One entry per page, listing the same page in every language. */
const entry = (path: string): MetadataRoute.Sitemap[number] => ({
  url: `${siteUrl}/${routing.defaultLocale}${path}`,
  alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`])) },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Build it when asked, so new services appear without a redeploy
  await connection();
  let services: ServiceSummary[] = [];
  try {
    services = (await publicJson<{ services: ServiceSummary[] }>("/api/services?locale=en"))?.services ?? [];
  } catch (err) {
    // The rest of the sitemap is still worth serving
    console.error("Sitemap could not load services", err);
  }
  return [
    ...sections.map(entry),
    ...services.map((s) => entry(`/services/${s.slug}`)),
    ...zodiacSigns.map((sign) => entry(`/horoscope/${sign}`)),
  ];
}
