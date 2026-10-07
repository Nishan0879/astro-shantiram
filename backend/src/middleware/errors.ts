import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not_found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Malformed JSON bodies come through here from express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
