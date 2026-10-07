import { boolean, date, integer, jsonb, pgTable, primaryKey, text, time, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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

export const articleCategories = [
  "astrology",
  "spiritual",
  "festivals",
  "sanskrit",
  "culture",
  "puja",
  "dharma",
  "guidance",
] as const;
export type ArticleCategory = (typeof articleCategories)[number];

export const contentLocales = ["en", "ne", "sa"] as const;
export type ContentLocale = (typeof contentLocales)[number];

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Used in the address, e.g. /articles/meaning-of-maha-shivaratri
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  category: varchar("category", { length: 32 }).$type<ArticleCategory>().notNull(),
  status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
  // Set the first time the article is published
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  // Optional cover photo (a Cloudinary URL)
  coverUrl: varchar("cover_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per language an article is written in
export const articleTranslations = pgTable(
  "article_translations",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    summary: varchar("summary", { length: 500 }),
    body: text("body").notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.locale] })],
);

export type Article = typeof articles.$inferSelect;
export type ArticleTranslation = typeof articleTranslations.$inferSelect;

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
  // US Central date and times, as the organiser types them
  eventDate: date("event_date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  registrationUrl: varchar("registration_url", { length: 500 }),
  youtubeUrl: varchar("youtube_url", { length: 500 }),
  zoomUrl: varchar("zoom_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventTranslations = pgTable(
  "event_translations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    location: varchar("location", { length: 200 }),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.locale] })],
);

export type Event = typeof events.$inferSelect;

export const galleryCategories = ["guruji", "temple", "puja", "events", "community", "spiritual", "travel"] as const;
export type GalleryCategory = (typeof galleryCategories)[number];

export type Captions = Partial<Record<ContentLocale, string>>;

export const galleryItems = pgTable("gallery_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: varchar("kind", { length: 8 }).$type<"photo" | "video">().notNull(),
  category: varchar("category", { length: 32 }).$type<GalleryCategory>().notNull(),
  // Photos: the Cloudinary copy. Videos: a YouTube link.
  url: varchar("url", { length: 500 }).notNull(),
  publicId: varchar("public_id", { length: 300 }),
  width: integer("width"),
  height: integer("height"),
  captions: jsonb("captions").$type<Captions>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GalleryItem = typeof galleryItems.$inferSelect;

export const bookCategories = ["astrology", "spirituality", "dharma", "sanskrit", "culture", "puja", "philosophy", "other"] as const;
export type BookCategory = (typeof bookCategories)[number];

// The language the book itself is written in (it may be one we have no site translation for)
export const bookLanguages = ["en", "ne", "sa", "hi", "other"] as const;
export type BookLanguage = (typeof bookLanguages)[number];

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
  category: varchar("category", { length: 32 }).$type<BookCategory>().notNull(),
  language: varchar("language", { length: 8 }).$type<BookLanguage>().notNull(),
  publishedOn: date("published_on"),
  featured: boolean("featured").notNull().default(false),
  // The PDF lives in Cloudinary; its first page doubles as the cover when there is no cover photo
  pdfUrl: varchar("pdf_url", { length: 500 }).notNull(),
  pdfPublicId: varchar("pdf_public_id", { length: 300 }),
  pageCount: integer("page_count"),
  coverUrl: varchar("cover_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Title, author and description per site language
export const bookTranslations = pgTable(
  "book_translations",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    author: varchar("author", { length: 200 }),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.locale] })],
);

export type Book = typeof books.$inferSelect;

// Pravachan and other YouTube videos. Only the video id is stored; YouTube hosts and serves the video.
export const videoCategories = [
  "gita",
  "vedas",
  "upanishads",
  "puranas",
  "dharma",
  "spirituality",
  "culture",
  "festivals",
  "astrology",
  "puja",
  "other",
] as const;
export type VideoCategory = (typeof videoCategories)[number];

export const videoKinds = ["video", "short", "live"] as const;
export type VideoKind = (typeof videoKinds)[number];

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  youtubeId: varchar("youtube_id", { length: 20 }).notNull().unique(),
  kind: varchar("kind", { length: 8 }).$type<VideoKind>().notNull().default("video"),
  status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
  category: varchar("category", { length: 32 }).$type<VideoCategory>().notNull(),
  // The language spoken in the video
  language: varchar("language", { length: 8 }).$type<BookLanguage>().notNull(),
  publishedOn: date("published_on"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Title and description per site language
export const videoTranslations = pgTable(
  "video_translations",
  {
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.locale] })],
);
