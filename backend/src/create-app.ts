import cors from "cors";
import express from "express";
import helmetImport from "helmet";
import type { Database } from "./db/client.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { adminArticlesRouter } from "./routes/admin-articles.js";
import { adminBooksRouter } from "./routes/admin-books.js";
import { adminEventsRouter } from "./routes/admin-events.js";
import { adminGalleryRouter, adminUploadsRouter } from "./routes/admin-media.js";
import { adminMessagesRouter } from "./routes/admin-messages.js";
import { articlesRouter } from "./routes/articles.js";
import { booksRouter } from "./routes/books.js";
import { eventsRouter } from "./routes/events.js";
import { galleryRouter } from "./routes/gallery.js";
import { authRouter, type BootstrapAdmin } from "./routes/auth.js";
import { contactRouter } from "./routes/contact.js";
import type { Mailer } from "./services/mailer.js";
import type { Media } from "./services/media.js";

// Vercel's builder type-checks files as CommonJS, where helmet's default import
// is typed as the module object. At runtime it is the middleware either way.
const helmet = helmetImport as unknown as typeof import("helmet").default;

export type AppDeps = {
  db: Database;
  mailer: Mailer;
  corsOrigins: string[];
  notifyEmail?: string;
  internalApiKey?: string;
  jwtSecret?: string;
  bootstrapAdmin?: BootstrapAdmin;
  media?: Media;
  /** Why photo uploads are off, shown to admins */
  mediaProblem?: string;
};

export function createApp({
  db,
  mailer,
  corsOrigins,
  notifyEmail,
  internalApiKey,
  jwtSecret,
  bootstrapAdmin,
  media,
  mediaProblem,
}: AppDeps) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/contact", contactRouter({ db, mailer, notifyEmail, internalApiKey }));
  app.use("/api/auth", authRouter({ db, jwtSecret, internalApiKey, bootstrapAdmin }));
  app.use("/api/articles", articlesRouter({ db }));
  app.use(
    "/api/admin/articles",
    requireAuth(db, jwtSecret),
    requireRole("super_admin", "content_admin", "guru"),
    adminArticlesRouter({ db, media }),
  );
  app.use("/api/events", eventsRouter({ db }));
  app.use(
    "/api/admin/events",
    requireAuth(db, jwtSecret),
    requireRole("super_admin", "content_admin", "guru"),
    adminEventsRouter({ db }),
  );
  app.use("/api/gallery", galleryRouter({ db }));
  const contentEditors = [requireAuth(db, jwtSecret), requireRole("super_admin", "content_admin", "guru")];
  app.use("/api/admin/uploads", ...contentEditors, adminUploadsRouter({ media, mediaProblem }));
  app.use("/api/admin/gallery", ...contentEditors, adminGalleryRouter({ db, media }));
  app.use("/api/books", booksRouter({ db }));
  app.use("/api/admin/books", ...contentEditors, adminBooksRouter({ db, media }));
  app.use(
    "/api/admin/contact-messages",
    requireAuth(db, jwtSecret),
    requireRole("super_admin"),
    adminMessagesRouter({ db }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
