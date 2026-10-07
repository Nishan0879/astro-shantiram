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

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
