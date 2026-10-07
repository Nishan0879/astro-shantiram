import { ipKeyGenerator, rateLimit } from "express-rate-limit";

/**
 * The website calls the API from its server, so every request shares its IP. When it
 * proves itself with the internal key, limit by the visitor IP it forwards instead.
 */
export function visitorRateLimit({
  internalApiKey,
  limit,
  windowMs = 15 * 60 * 1000,
  failuresOnly = false,
}: {
  internalApiKey?: string;
  limit: number;
  windowMs?: number;
  // Count only failed requests, so normal sign-ins never lock anyone out
  failuresOnly?: boolean;
}) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: failuresOnly,
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
}
