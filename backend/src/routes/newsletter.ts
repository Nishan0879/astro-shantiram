import { and, count, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { newsletterIssues, newsletterSubscribers, subscriberStatuses } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import { websiteOnly } from "../middleware/website-only.js";
import type { BookingLinks } from "../services/booking-links.js";
import type { Mailer } from "../services/mailer.js";
import { confirmMail, issueMail, newsletterKeyMatches, progress, queueIssue, sendBatch } from "../services/newsletter.js";

const email = z.email("Enter a valid email").max(254).transform((e) => e.toLowerCase());
const subscribeInput = z.object({ email, locale: z.enum(["en", "ne", "sa"]).optional() });
const linkInput = z.object({ email, key: z.string() });

/** Signing up for email updates, confirming, and leaving. */
export function newsletterRouter({
  db,
  mailer,
  internalApiKey,
  links,
}: {
  db: Database;
  mailer: Mailer;
  internalApiKey?: string;
  links?: BookingLinks;
}) {
  const router = Router();

  router.use((_req, res, next) => {
    // The links in the emails are signed with JWT_SECRET
    if (!links) res.status(503).json({ error: "newsletter_not_configured" });
    else next();
  });

  router.post("/subscribe", websiteOnly(internalApiKey), visitorRateLimit({ internalApiKey, limit: 5 }), async (req, res) => {
    const parsed = subscribeInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    const { email, locale = "en" } = parsed.data;
    const [existing] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    // The same answer whether or not they are already on the list, so the form cannot be used to check who is
    if (existing?.status !== "subscribed") {
      if (existing) {
        await db.update(newsletterSubscribers).set({ status: "pending", locale }).where(eq(newsletterSubscribers.id, existing.id));
      } else {
        await db.insert(newsletterSubscribers).values({ email, locale });
      }
      await mailer.send(confirmMail(links!, email, locale)).catch((err) => console.error("Failed to send newsletter confirmation", err));
    }
    res.status(202).json({ ok: true });
  });

  // Wrong keys count against the visitor, so keys cannot be guessed at speed
  const linkLimit = visitorRateLimit({ internalApiKey, limit: 30, failuresOnly: true });

  router.post("/confirm", linkLimit, async (req, res) => {
    const parsed = linkInput.safeParse(req.body);
    if (!parsed.success || !newsletterKeyMatches(links!.secret, "confirm", parsed.data.email, parsed.data.key)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [row] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, parsed.data.email));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (row.status !== "subscribed") {
      await db
        .update(newsletterSubscribers)
        .set({ status: "subscribed", confirmedAt: new Date(), unsubscribedAt: null })
        .where(eq(newsletterSubscribers.id, row.id));
    }
    res.json({ status: "subscribed" });
  });

  // From the page's button, or from a mail app's own "Unsubscribe" (which sends the key in the address)
  router.post("/unsubscribe", linkLimit, async (req, res) => {
    const parsed = linkInput.safeParse({ email: req.body?.email ?? req.query.email, key: req.body?.key ?? req.query.key });
    if (!parsed.success || !newsletterKeyMatches(links!.secret, "unsubscribe", parsed.data.email, parsed.data.key)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await db
      .update(newsletterSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.email, parsed.data.email));
    res.json({ status: "unsubscribed" });
  });

  return router;
}

const issueInput = z.object({
  subject: z.string().trim().min(1, "Write a subject").max(200),
  body: z.string().trim().min(1, "Write the message").max(20000),
});

const fieldErrorsOf = (error: z.ZodError) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fieldErrors;
};

/** Writing and sending updates, and the subscriber list; mount behind requireAuth. */
export function adminNewsletterRouter({ db, mailer, links }: { db: Database; mailer: Mailer; links?: BookingLinks }) {
  const router = Router();
  const idParam = z.uuid();

  async function load(id: string) {
    const parsed = idParam.safeParse(id);
    if (!parsed.success) return undefined;
    const [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, parsed.data));
    return issue;
  }

  router.get("/", async (_req, res) => {
    const [issues, byStatus] = await Promise.all([
      db.select().from(newsletterIssues).orderBy(desc(newsletterIssues.createdAt)).limit(100),
      db.select({ status: newsletterSubscribers.status, total: count() }).from(newsletterSubscribers).groupBy(newsletterSubscribers.status),
    ]);
    const counts = Object.fromEntries(subscriberStatuses.map((s) => [s, 0])) as Record<string, number>;
    for (const row of byStatus) counts[row.status] = row.total;
    res.json({ issues, counts, emailReady: mailer.configured !== false && Boolean(links) });
  });

  router.get("/subscribers", async (_req, res) => {
    const subscribers = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(2000);
    res.json({ subscribers });
  });

  // For someone who asks to be taken off the list completely
  router.delete("/subscribers/:id", async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (id.success) await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id.data));
    res.status(204).end();
  });

  router.post("/issues", async (req, res) => {
    const parsed = issueInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const [issue] = await db.insert(newsletterIssues).values(parsed.data).returning();
    res.status(201).json({ issue });
  });

  router.get("/issues/:id", async (req, res) => {
    const issue = await load(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ issue, ...(issue.status === "draft" ? {} : await progress(db, issue.id)) });
  });

  router.put("/issues/:id", async (req, res) => {
    const issue = await load(req.params.id);
    const parsed = issueInput.safeParse(req.body);
    if (!issue) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (issue.status !== "draft") {
      res.status(409).json({ error: "already_sent" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: "validation_failed", fieldErrors: fieldErrorsOf(parsed.error) });
      return;
    }
    const [updated] = await db.update(newsletterIssues).set({ ...parsed.data, updatedAt: new Date() }).where(eq(newsletterIssues.id, issue.id)).returning();
    res.json({ issue: updated });
  });

  router.delete("/issues/:id", async (req, res) => {
    const issue = await load(req.params.id);
    if (issue && issue.status !== "draft") {
      res.status(409).json({ error: "already_sent" });
      return;
    }
    if (issue) await db.delete(newsletterIssues).where(eq(newsletterIssues.id, issue.id));
    res.status(204).end();
  });

  // A copy to the signed-in admin, to check how it looks before everyone gets it
  router.post("/issues/:id/test", async (req, res) => {
    const issue = await load(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (mailer.configured === false || !links) {
      res.status(503).json({ error: "email_not_configured" });
      return;
    }
    const to = res.locals.user.email;
    try {
      await mailer.send({ ...issueMail(links, issue, { email: to, locale: "en" }), subject: `[Test] ${issue.subject}` });
    } catch (err) {
      console.error("Test newsletter failed", err);
      res.status(502).json({ error: "send_failed" });
      return;
    }
    res.json({ sentTo: to });
  });

  // Starts sending a draft, then sends the next few each time it is called
  router.post("/issues/:id/send", async (req, res) => {
    let issue = await load(req.params.id);
    if (!issue) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (mailer.configured === false || !links) {
      res.status(503).json({ error: "email_not_configured" });
      return;
    }
    if (issue.status === "draft") issue = (await queueIssue(db, issue.id)) ?? issue;
    res.json(await sendBatch(db, mailer, links, issue.id));
  });

  return router;
}
