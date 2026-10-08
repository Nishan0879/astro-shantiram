import { Router } from "express";
import { z } from "zod";
import { usPhone } from "../services/phone.js";
import type { Database } from "../db/client.js";
import { contactMessages } from "../db/schema.js";
import { visitorRateLimit } from "../middleware/rate-limit.js";
import type { Mailer } from "../services/mailer.js";

export const inquiryCategories = [
  "general",
  "puja",
  "astrology",
  "consultation",
  "events",
  "books",
  "other",
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  // Optional; left blank it is not stored
  phone: z.union([z.literal("").transform(() => undefined), usPhone]).optional(),
  category: z.enum(inquiryCategories),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(["en", "ne", "sa"]).optional(),
});

type Deps = { db: Database; mailer: Mailer; notifyEmail?: string; internalApiKey?: string };

export function contactRouter({ db, mailer, notifyEmail, internalApiKey }: Deps) {
  const router = Router();

  const limiter = visitorRateLimit({ internalApiKey, limit: 10 });

  router.post(
    "/",
    limiter,
    async (req, res) => {
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "validation_failed", fieldErrors: z.flattenError(parsed.error).fieldErrors });
        return;
      }

      const [saved] = await db
        .insert(contactMessages)
        .values(parsed.data)
        .returning({ id: contactMessages.id });

      if (notifyEmail) {
        const m = parsed.data;
        // The message is already saved, so a mail failure must not fail the request
        await mailer
          .send({
            to: notifyEmail,
            replyTo: m.email,
            subject: `[Astro Shantiram] ${m.category}: ${m.subject}`,
            text: `From: ${m.name} <${m.email}>${m.phone ? `\nPhone: ${m.phone}` : ""}\nCategory: ${m.category}\n\n${m.message}`,
          })
          .catch((err) => console.error("Failed to send contact notification", err));
      }

      res.status(201).json({ id: saved.id });
    },
  );

  return router;
}
