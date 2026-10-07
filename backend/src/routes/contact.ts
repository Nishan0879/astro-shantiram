import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { contactMessages } from "../db/schema.js";
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
  phone: z.string().trim().max(40).optional().transform((v) => v || undefined),
  category: z.enum(inquiryCategories),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(["en", "ne", "sa"]).optional(),
});

type Deps = { db: Database; mailer: Mailer; notifyEmail?: string; internalApiKey?: string };

export function contactRouter({ db, mailer, notifyEmail, internalApiKey }: Deps) {
  const router = Router();

  // The website submits from its server, so every request shares its IP. When it
  // proves itself with the internal key, limit by the visitor IP it forwards.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const visitorIp = req.get("x-visitor-ip");
      if (internalApiKey && visitorIp && req.get("x-internal-key") === internalApiKey) {
        return ipKeyGenerator(visitorIp);
      }
      return ipKeyGenerator(req.ip ?? "unknown");
    },
  });

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
