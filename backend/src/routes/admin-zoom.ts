import { Router } from "express";
import type { Zoom } from "../services/zoom.js";

/** Lets the admin see whether Zoom is set up and check its login; mount behind requireAuth. */
export function adminZoomRouter({ zoom }: { zoom?: Zoom }) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ configured: Boolean(zoom) });
  });

  router.post("/test", async (_req, res) => {
    if (!zoom) {
      res.status(503).json({ error: "not_configured" });
      return;
    }
    try {
      await zoom.checkLogin();
      res.json({ ok: true });
    } catch (err) {
      console.error("Zoom login check failed", err);
      res.status(502).json({ error: "zoom_failed", detail: err instanceof Error ? err.message.slice(0, 300) : "Unknown error" });
    }
  });

  return router;
}
