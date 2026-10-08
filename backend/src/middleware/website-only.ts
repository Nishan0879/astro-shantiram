import type { RequestHandler } from "express";

/**
 * Lets only the website send this form: it adds the internal key, which spam bots
 * posting straight to the API do not have. Open when no key is set (local work, tests).
 */
export function websiteOnly(internalApiKey?: string): RequestHandler {
  return (req, res, next) => {
    if (internalApiKey && req.get("x-internal-key") !== internalApiKey) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
