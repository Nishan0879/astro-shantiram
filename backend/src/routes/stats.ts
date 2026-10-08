import { createHash } from "node:crypto";
import { and, count, countDistinct, desc, gte, isNotNull, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { pageViews } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { addDays, centralClock } from "../services/booking.js";

const viewInput = z.object({
  path: z.string().trim().min(1).max(300).startsWith("/"),
  referrer: z.string().trim().max(500).default(""),
});

const BOTS = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python|java\//i;

/** "mobile", "tablet" or "desktop" from the browser's user agent. */
export function deviceOf(userAgent: string) {
  if (/ipad|tablet|kindle|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** The other site's host name, or null for a direct visit or a page on this site. */
export function referrerHost(referrer: string, ownHosts: string[]) {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    return !host || ownHosts.includes(host) ? null : host.slice(0, 200);
  } catch {
    return null;
  }
}

/**
 * Counts page views the website reports. Only the website can report them (it sends the
 * internal key), and it passes on the visitor's IP and browser just long enough to make
 * the day's anonymous visitor hash; neither is stored.
 */
export function statsRouter({ db, internalApiKey, siteHosts = [], now = () => new Date() }: { db: Database; internalApiKey?: string; siteHosts?: string[]; now?: () => Date }) {
  const router = Router();

  router.post("/view", visitorRateLimit({ internalApiKey, limit: 300 }), async (req, res) => {
    if (!internalApiKey || req.get("x-internal-key") !== internalApiKey) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const parsed = viewInput.safeParse(req.body);
    const userAgent = req.get("x-visitor-ua") ?? "";
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    // Bots are not visitors; the admin pages are not part of the public site
    if (!userAgent || BOTS.test(userAgent) || /^\/admin(\/|$)/.test(parsed.data.path)) {
      res.status(204).end();
      return;
    }
    const day = centralClock(now()).date;
    const ip = req.get("x-visitor-ip") ?? "";
    const visitor = createHash("sha256").update(`${internalApiKey}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
    const path = parsed.data.path.split(/[?#]/)[0].slice(0, 300);
    const locale = path.match(/^\/(en|ne|sa)(\/|$)/)?.[1] ?? null;
    await db.insert(pageViews).values({
      day,
      path,
      locale,
      referrer: referrerHost(parsed.data.referrer, siteHosts),
      device: deviceOf(userAgent),
      visitor,
    });
    res.status(204).end();
  });

  return router;
}

const rangeQuery = z.object({ days: z.coerce.number().int().min(1).max(366).catch(30) });

/** Visitor numbers for the admin dashboard; mount behind requireAuth. */
export function adminStatsRouter({ db, now = () => new Date() }: { db: Database; now?: () => Date }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { days } = rangeQuery.parse(req.query);
    const today = centralClock(now()).date;
    const from = addDays(today, -(days - 1));
    const inRange = gte(pageViews.day, from);
    // A page is the same page in every language, so /ne/books and /en/books count together
    const page = sql<string>`coalesce(nullif(regexp_replace(${pageViews.path}, '^/(en|ne|sa)(/|$)', '/'), ''), '/')`;

    const [perDay, [totals], pages, referrers, devices, locales] = await Promise.all([
      db
        .select({ date: pageViews.day, views: count(), visitors: countDistinct(pageViews.visitor) })
        .from(pageViews)
        .where(inRange)
        .groupBy(pageViews.day),
      // Visitors over the whole range: the hash changes daily, so this adds up each day's people
      db
        .select({ views: count(), visitors: sql<number>`count(distinct (${pageViews.day}, ${pageViews.visitor}))`.mapWith(Number) })
        .from(pageViews)
        .where(inRange),
      db.select({ path: page, views: count() }).from(pageViews).where(inRange).groupBy(page).orderBy(desc(count())).limit(10),
      db
        .select({ host: pageViews.referrer, visitors: countDistinct(pageViews.visitor) })
        .from(pageViews)
        .where(and(inRange, isNotNull(pageViews.referrer)))
        .groupBy(pageViews.referrer)
        .orderBy(desc(countDistinct(pageViews.visitor)))
        .limit(10),
      db.select({ device: pageViews.device, visitors: countDistinct(pageViews.visitor) }).from(pageViews).where(inRange).groupBy(pageViews.device),
      db
        .select({ locale: pageViews.locale, views: count() })
        .from(pageViews)
        .where(and(inRange, isNotNull(pageViews.locale)))
        .groupBy(pageViews.locale),
    ]);

    // Every day in the range, with zeros for quiet days, so the chart has no gaps
    const byDay = new Map(perDay.map((d) => [d.date, d]));
    res.json({
      from,
      today,
      totals,
      days: Array.from({ length: days }, (_, i) => addDays(from, i)).map((date) => ({
        date,
        views: byDay.get(date)?.views ?? 0,
        visitors: byDay.get(date)?.visitors ?? 0,
      })),
      pages,
      referrers,
      devices,
      locales,
    });
  });

  return router;
}
