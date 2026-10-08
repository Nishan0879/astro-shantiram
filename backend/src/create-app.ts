import cors from "cors";
import express from "express";
import helmetImport from "helmet";
import type { Database } from "./db/client.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { adminAppointmentsRouter, adminScheduleRouter } from "./routes/admin-appointments.js";
import { adminArticlesRouter } from "./routes/admin-articles.js";
import { cronRouter } from "./routes/cron.js";
import { adminZoomRouter } from "./routes/admin-zoom.js";
import { adminEmailRouter } from "./routes/admin-email.js";
import { adminBooksRouter } from "./routes/admin-books.js";
import { adminEventsRouter } from "./routes/admin-events.js";
import { adminGalleryRouter, adminUploadsRouter } from "./routes/admin-media.js";
import { adminHoroscopesRouter } from "./routes/admin-horoscopes.js";
import { adminMessagesRouter } from "./routes/admin-messages.js";
import { adminServicesRouter } from "./routes/admin-services.js";
import { adminVideosRouter } from "./routes/admin-videos.js";
import { articlesRouter } from "./routes/articles.js";
import { bookingRouter } from "./routes/booking.js";
import { booksRouter } from "./routes/books.js";
import { eventsRouter } from "./routes/events.js";
import { galleryRouter } from "./routes/gallery.js";
import { horoscopesRouter } from "./routes/horoscopes.js";
import { servicesRouter } from "./routes/services.js";
import { videosRouter } from "./routes/videos.js";
import { authRouter, type BootstrapAdmin } from "./routes/auth.js";
import { contactRouter } from "./routes/contact.js";
import type { Mailer } from "./services/mailer.js";
import type { Media } from "./services/media.js";
import type { Zoom } from "./services/zoom.js";

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
  /** Reaches YouTube for video titles; tests pass a stand-in */
  youtubeFetch?: typeof fetch;
  /** Today's date in US Central time; tests pin it */
  today?: () => string;
  /** The current moment, for booking; tests pin it */
  now?: () => Date;
  /** Vercel Cron's shared secret; scheduled jobs stay off without it */
  cronSecret?: string;
  /** Makes Zoom meetings for Zoom bookings; off when Zoom is not set up */
  zoom?: Zoom;
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
  youtubeFetch,
  today,
  now,
  cronSecret,
  zoom,
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
  app.use("/api/videos", videosRouter({ db }));
  app.use("/api/admin/videos", ...contentEditors, adminVideosRouter({ db, fetchImpl: youtubeFetch }));
  app.use("/api/horoscopes", horoscopesRouter({ db, today }));
  app.use("/api/admin/horoscopes", ...contentEditors, adminHoroscopesRouter({ db }));
  app.use("/api/services", servicesRouter({ db }));
  app.use("/api/admin/services", ...contentEditors, adminServicesRouter({ db, media }));
  const schedulers = [requireAuth(db, jwtSecret), requireRole("super_admin", "appointment_manager", "guru")];
  app.use("/api/booking", bookingRouter({ db, mailer, notifyEmail, internalApiKey, now }));
  app.use("/api/admin/appointments", ...schedulers, adminAppointmentsRouter({ db, mailer, now, zoom }));
  app.use("/api/admin/schedule", ...schedulers, adminScheduleRouter({ db, now }));
  app.use("/api/cron", cronRouter({ db, mailer, cronSecret, now }));
  app.use("/api/admin/zoom", requireAuth(db, jwtSecret), requireRole("super_admin"), adminZoomRouter({ zoom }));
  app.use("/api/admin/email", requireAuth(db, jwtSecret), requireRole("super_admin"), adminEmailRouter({ mailer, notifyEmail }));
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
