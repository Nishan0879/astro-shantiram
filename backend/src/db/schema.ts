import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  category: varchar("category", { length: 32 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  locale: varchar("locale", { length: 8 }),
  // new → read → replied / archived, managed from the admin dashboard later
  status: varchar("status", { length: 16 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactStatuses = ["new", "read", "replied", "archived"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;

export const userRoles = ["super_admin", "content_admin", "appointment_manager", "guru"] as const;
export type UserRole = (typeof userRoles)[number];

// People who can sign in to the admin dashboard
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 32 }).$type<UserRole>().notNull().default("super_admin"),
  // Sign-in tokens issued before this moment stop working (set on password change)
  tokensValidAfter: timestamp("tokens_valid_after", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
