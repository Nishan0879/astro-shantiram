import { Router } from "express";
import type { Mailer } from "../services/mailer.js";

/** Lets the admin see whether email is set up and send themselves a test; mount behind requireAuth. */
export function adminEmailRouter({ mailer, notifyEmail }: { mailer: Mailer; notifyEmail?: string }) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ configured: mailer.configured !== false, notifyEmail: notifyEmail ?? null });
  });

  router.post("/test", async (_req, res) => {
    if (mailer.configured === false) {
      res.status(503).json({ error: "not_configured" });
      return;
    }
    const to = notifyEmail ?? res.locals.user.email;
    try {
      await mailer.send({
        to,
        subject: "Test email from the Astro Shantiram website",
        text: "Namaste,\n\nEmail from the website works. Booking confirmations, new-booking alerts and contact messages will arrive like this one.\n\nAstro Shantiram",
      });
      res.json({ sentTo: to });
    } catch (err) {
      console.error("Test email failed", err);
      // The mail server's own words help most when the login or host is wrong
      const detail = err instanceof Error ? err.message.slice(0, 300) : "Unknown error";
      res.status(502).json({ error: "send_failed", detail });
    }
  });

  return router;
}
