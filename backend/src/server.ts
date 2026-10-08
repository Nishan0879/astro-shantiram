import type { Express } from "express";
import { createApp } from "./create-app.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./db/client.js";
import { createMailer } from "./services/mailer.js";
import { zoomClient } from "./services/zoom.js";
import { cloudinaryMedia, describeCloudinaryProblem, parseCloudinaryUrl } from "./services/media.js";

const env = loadEnv();
const cloudinary = env.CLOUDINARY_URL ? parseCloudinaryUrl(env.CLOUDINARY_URL) : null;
const mediaProblem = describeCloudinaryProblem(env.CLOUDINARY_URL) ?? undefined;
if (env.CLOUDINARY_URL && mediaProblem) console.error(mediaProblem);

// Vercel deploys the first of app/index/server(.ts) that imports "express",
// so this file is the entry and the app factory lives in create-app.ts.
const app: Express = createApp({
  db: createDb(env.DATABASE_URL),
  mailer: createMailer(env),
  corsOrigins: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  notifyEmail: env.CONTACT_NOTIFY_EMAIL,
  internalApiKey: env.INTERNAL_API_KEY,
  jwtSecret: env.JWT_SECRET,
  bootstrapAdmin:
    env.ADMIN_EMAIL && env.ADMIN_PASSWORD
      ? { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, name: env.ADMIN_NAME }
      : undefined,
  media: cloudinary ? cloudinaryMedia(cloudinary, env.CLOUDINARY_API_BASE) : undefined,
  mediaProblem,
  cronSecret: env.CRON_SECRET,
  siteUrl: env.SITE_URL,
  zoom:
    env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET
      ? zoomClient({
          accountId: env.ZOOM_ACCOUNT_ID,
          clientId: env.ZOOM_CLIENT_ID,
          clientSecret: env.ZOOM_CLIENT_SECRET,
          host: env.ZOOM_HOST_EMAIL,
        })
      : undefined,
});

// Vercel imports the default export as a function; elsewhere we listen ourselves
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
}

export default app;
