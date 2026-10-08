import { createHmac, timingSafeEqual } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  type ContentLocale,
  type NewsletterIssue,
  newsletterDeliveries,
  newsletterIssues,
  newsletterSubscribers,
} from "../db/schema.js";
import type { BookingLinks } from "./booking-links.js";
import type { Mail, Mailer } from "./mailer.js";

type Purpose = "confirm" | "unsubscribe";

/**
 * The key in a subscriber's confirm or unsubscribe link, signed from their email, so the
 * links need no database column and cannot be made for someone else's address.
 */
export function newsletterKey(secret: string, purpose: Purpose, email: string) {
  return createHmac("sha256", secret).update(`newsletter-${purpose}:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function newsletterKeyMatches(secret: string, purpose: Purpose, email: string, key: unknown) {
  if (typeof key !== "string" || key.length !== 32) return false;
  return timingSafeEqual(Buffer.from(newsletterKey(secret, purpose, email)), Buffer.from(key));
}

/** The website page that confirms or offers to unsubscribe. */
export function newsletterPageUrl(links: BookingLinks, purpose: Purpose, email: string, locale: string | null) {
  const query = new URLSearchParams({ [purpose]: "1", email, key: newsletterKey(links.secret, purpose, email) });
  return `${links.siteUrl.replace(/\/$/, "")}/${locale ?? "en"}/newsletter?${query}`;
}

/** Where mail apps' own "Unsubscribe" button posts (RFC 8058 one-click). */
function oneClickUrl(links: BookingLinks, email: string) {
  const query = new URLSearchParams({ email, key: newsletterKey(links.secret, "unsubscribe", email) });
  return `${links.siteUrl.replace(/\/$/, "")}/api/newsletter/unsubscribe?${query}`;
}

const confirmText: Record<ContentLocale, { subject: string; body: (link: string) => string }> = {
  en: {
    subject: "Please confirm your email for Astro Shantiram updates",
    body: (link) =>
      `Namaste,\n\nThank you for signing up for updates from Astro Shantiram: festivals, horoscopes, events and teachings.\n\nPlease confirm your email by opening this link:\n${link}\n\nIf you did not sign up, you can ignore this email and you will not hear from us.\n\nAstro Shantiram`,
  },
  ne: {
    subject: "Astro Shantiram का अपडेटका लागि आफ्नो इमेल पुष्टि गर्नुहोस्",
    body: (link) =>
      `नमस्ते,\n\nAstro Shantiram बाट चाडपर्व, राशिफल, कार्यक्रम र प्रवचनका अपडेट पाउन दर्ता गर्नुभएकोमा धन्यवाद।\n\nकृपया यो लिङ्क खोलेर आफ्नो इमेल पुष्टि गर्नुहोस्:\n${link}\n\nतपाईंले दर्ता गर्नुभएको होइन भने यो इमेल बेवास्ता गर्नुहोस्।\n\nAstro Shantiram`,
  },
  sa: {
    subject: "Astro Shantiram वार्तानां कृते ईमेल पुष्टिं करोतु",
    body: (link) =>
      `नमस्ते,\n\nAstro Shantiram तः उत्सव-राशिफल-कार्यक्रम-प्रवचनवार्ताः प्राप्तुं पञ्जीकरणाय धन्यवादाः।\n\nकृपया अस्य लिङ्कस्य उद्घाटनेन ईमेल पुष्टिं करोतु:\n${link}\n\nयदि भवता पञ्जीकरणं न कृतं तर्हि इदम् ईमेल उपेक्षताम्।\n\nAstro Shantiram`,
  },
};

export function confirmMail(links: BookingLinks, email: string, locale: ContentLocale | null): Mail {
  const text = confirmText[locale ?? "en"];
  return { to: email, subject: text.subject, text: text.body(newsletterPageUrl(links, "confirm", email, locale)) };
}

/** An update as one subscriber receives it, with their own unsubscribe link. */
export function issueMail(links: BookingLinks, issue: Pick<NewsletterIssue, "subject" | "body">, to: { email: string; locale: string | null }): Mail {
  const unsubscribe = newsletterPageUrl(links, "unsubscribe", to.email, to.locale);
  return {
    to: to.email,
    subject: issue.subject,
    text: `${issue.body.trim()}\n\n—\nAstro Shantiram\nYou get these updates because you signed up on our website. To stop them: ${unsubscribe}`,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl(links, to.email)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Puts every current subscriber in line for the update and marks it as sending. */
export async function queueIssue(db: Database, issueId: string) {
  return db.transaction(async (tx) => {
    const [issue] = await tx
      .update(newsletterIssues)
      .set({ status: "sending", updatedAt: new Date() })
      .where(and(eq(newsletterIssues.id, issueId), eq(newsletterIssues.status, "draft")))
      .returning();
    if (!issue) return null;
    const people = await tx
      .select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.status, "subscribed"));
    if (people.length) {
      await tx.insert(newsletterDeliveries).values(people.map((p) => ({ issueId, subscriberId: p.id })));
    }
    const [queued] = await tx.update(newsletterIssues).set({ recipientCount: people.length }).where(eq(newsletterIssues.id, issueId)).returning();
    return queued;
  });
}

export const BATCH_SIZE = 10;

/**
 * Sends the next few emails of an update. Called again and again until nothing is left,
 * so no single call runs long. Each email is claimed before sending, so two calls at
 * once never send anyone the same update twice.
 */
export async function sendBatch(db: Database, mailer: Mailer, links: BookingLinks, issueId: string, limit = BATCH_SIZE) {
  const [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, issueId));
  if (!issue) return null;
  let sent = 0;
  let failed = 0;
  if (issue.status === "sending") {
    const next = await db
      .select({ subscriberId: newsletterDeliveries.subscriberId, email: newsletterSubscribers.email, locale: newsletterSubscribers.locale, status: newsletterSubscribers.status })
      .from(newsletterDeliveries)
      .innerJoin(newsletterSubscribers, eq(newsletterSubscribers.id, newsletterDeliveries.subscriberId))
      .where(and(eq(newsletterDeliveries.issueId, issueId), eq(newsletterDeliveries.status, "queued")))
      .limit(limit);
    for (const person of next) {
      const where = and(
        eq(newsletterDeliveries.issueId, issueId),
        eq(newsletterDeliveries.subscriberId, person.subscriberId),
        eq(newsletterDeliveries.status, "queued"),
      );
      // Someone who unsubscribed since the update was queued does not get it
      const claim = person.status === "subscribed" ? "sending" : "skipped";
      const [claimed] = await db.update(newsletterDeliveries).set({ status: claim }).where(where).returning();
      if (!claimed || claim === "skipped") continue;
      const done = and(eq(newsletterDeliveries.issueId, issueId), eq(newsletterDeliveries.subscriberId, person.subscriberId));
      try {
        await mailer.send(issueMail(links, issue, person));
        await db.update(newsletterDeliveries).set({ status: "sent", sentAt: new Date() }).where(done);
        sent++;
      } catch (err) {
        console.error("Newsletter email failed", err);
        await db.update(newsletterDeliveries).set({ status: "failed" }).where(done);
        failed++;
      }
    }
  }
  return progress(db, issueId);
}

/** How far an update has got, and marks it sent once nobody is left in line. */
export async function progress(db: Database, issueId: string) {
  const rows = await db
    .select({ status: newsletterDeliveries.status, total: count() })
    .from(newsletterDeliveries)
    .where(eq(newsletterDeliveries.issueId, issueId))
    .groupBy(newsletterDeliveries.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.total])) as Partial<Record<string, number>>;
  const remaining = (by.queued ?? 0) + (by.sending ?? 0);
  let [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, issueId));
  if (issue.status === "sending" && !by.queued) {
    [issue] = await db
      .update(newsletterIssues)
      .set({ status: "sent", sentAt: issue.sentAt ?? new Date(), sentCount: by.sent ?? 0, updatedAt: new Date() })
      .where(eq(newsletterIssues.id, issueId))
      .returning();
  } else if (issue.sentCount !== (by.sent ?? 0)) {
    [issue] = await db.update(newsletterIssues).set({ sentCount: by.sent ?? 0 }).where(eq(newsletterIssues.id, issueId)).returning();
  }
  return { issue, sent: by.sent ?? 0, failed: by.failed ?? 0, remaining };
}
