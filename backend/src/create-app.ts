import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Database } from "./db/client.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { contactRouter } from "./routes/contact.js";
import type { Mailer } from "./services/mailer.js";

export type AppDeps = {
  db: Database;
  mailer: Mailer;
  corsOrigins: string[];
  notifyEmail?: string;
  internalApiKey?: string;
};

export function createApp({ db, mailer, corsOrigins, notifyEmail, internalApiKey }: AppDeps) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/contact", contactRouter({ db, mailer, notifyEmail, internalApiKey }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
