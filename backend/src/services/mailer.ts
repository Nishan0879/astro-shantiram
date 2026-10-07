import nodemailer from "nodemailer";
import type { Env } from "../config/env.js";

export type Mail = { to: string; subject: string; text: string; replyTo?: string };
export type Mailer = { send(mail: Mail): Promise<void> };

/** Sends through SMTP when it is configured, otherwise logs and skips. */
export function createMailer(env: Env): Mailer {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return {
      async send(mail) {
        console.warn(`SMTP not configured; skipped email "${mail.subject}" to ${mail.to}`);
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  return {
    async send(mail) {
      await transport.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, ...mail });
    },
  };
}
