import type { Express } from "express";
import { createApp } from "./create-app.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./db/client.js";
import { createMailer } from "./services/mailer.js";

const env = loadEnv();

// Vercel deploys the first of app/index/server(.ts) that imports "express",
// so this file is the entry and the app factory lives in create-app.ts.
const app: Express = createApp({
  db: createDb(env.DATABASE_URL),
  mailer: createMailer(env),
  corsOrigins: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  notifyEmail: env.CONTACT_NOTIFY_EMAIL,
  internalApiKey: env.INTERNAL_API_KEY,
});

// Vercel imports the default export as a function; elsewhere we listen ourselves
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
}

export default app;
