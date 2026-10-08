/** The public address of the site, for search engines and link previews. Set SITE_URL once there is a custom domain. */
export const siteUrl = (process.env.SITE_URL ?? "https://astro-shantiram.vercel.app").replace(/\/+$/, "");

/** The astrologer is in Dallas-Fort Worth, so dates and times on the site are US Central. */
export const siteTimeZone = "America/Chicago";

// Guruji's channels. Stand-ins until the real links are known: change them here.
export const youtubeChannelUrl = "https://www.youtube.com/@The_Stoic_Thread";
export const facebookPageUrl = "https://www.facebook.com/";

/** True once facebookPageUrl names an actual page rather than facebook.com itself. */
export const hasFacebookPage = new URL(facebookPageUrl).pathname.replace(/\/+$/, "") !== "";

/** Facebook's own feed of the page (its Page Plugin), or null until there is a page. */
export function facebookFeedUrl(width: number) {
  if (!hasFacebookPage) return null;
  const page = new URL(facebookPageUrl);
  const query = new URLSearchParams({
    href: page.toString(),
    tabs: "timeline",
    width: String(width),
    height: "600",
    small_header: "true",
    adapt_container_width: "true",
    hide_cover: "false",
  });
  return `https://www.facebook.com/plugins/page.php?${query}`;
}

/** Today's date in US Central time, as YYYY-MM-DD. */
export const todayInSiteZone = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: siteTimeZone }).format(now);
