import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  // Comma-separated list of origins allowed to call the API from a browser
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // Shared secret the website sends so the API trusts its forwarded visitor IP
  INTERNAL_API_KEY: z.string().min(16).optional(),

  // Signs admin sign-in tokens; the admin dashboard stays off until it is set
  JWT_SECRET: z.string().min(32).optional(),
  // The first admin account, created on its first sign-in while no admins exist
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  ADMIN_NAME: z.string().optional(),

  // Photo storage: "cloudinary://<api_key>:<api_secret>@<cloud_name>" from the Cloudinary dashboard
  CLOUDINARY_URL: z.string().optional(),
  // Only for local testing against a stand-in for Cloudinary's API
  CLOUDINARY_API_BASE: z.url().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Where new contact messages are sent, and the From address used
  CONTACT_NOTIFY_EMAIL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
