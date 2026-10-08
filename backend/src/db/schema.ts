import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, time, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  category: varchar("category", { length: 32 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  locale: varchar("locale", { length: 8 }),
  // new → read → replied / archived, managed from the admin dashboard; spam is set on arrival
  status: varchar("status", { length: 16 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactStatuses = ["new", "read", "replied", "archived", "spam"] as const;
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

// Spiritual calendar: festivals, vrat days and special puja dates Guruji lists for the year
export const festivalKinds = ["festival", "ekadashi", "purnima", "amavasya", "sankranti", "puja", "other"] as const;
export type FestivalKind = (typeof festivalKinds)[number];

export const festivals = pgTable(
  "festivals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // US Central dates; a festival over several days has an end date
    date: date("date").notNull(),
    endDate: date("end_date"),
    kind: varchar("kind", { length: 16 }).$type<FestivalKind>().notNull(),
    status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("published"),
    // A service to offer a booking link for, like a Lakshmi puja at Tihar
    serviceSlug: varchar("service_slug", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("festivals_date_idx").on(t.date)],
);

export const festivalTranslations = pgTable(
  "festival_translations",
  {
    festivalId: uuid("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
  },
  (t) => [primaryKey({ columns: [t.festivalId, t.locale] })],
);

export type Festival = typeof festivals.$inferSelect;

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

// Horoscopes: Guruji writes an edition (a day, week, month, year, festival or special update)
// with a reading for each of the twelve rashis
export const zodiacSigns = [
  "mesha",
  "vrishabha",
  "mithuna",
  "karka",
  "simha",
  "kanya",
  "tula",
  "vrishchika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;
export type ZodiacSign = (typeof zodiacSigns)[number];

export const horoscopePeriods = ["daily", "weekly", "monthly", "yearly", "festival", "special"] as const;
export type HoroscopePeriod = (typeof horoscopePeriods)[number];

export const horoscopeEditions = pgTable(
  "horoscope_editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    period: varchar("period", { length: 16 }).$type<HoroscopePeriod>().notNull(),
    // The day, or the first day of the week, month or year it covers (US Central)
    startsOn: date("starts_on").notNull(),
    status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("horoscope_editions_period_starts_on_idx").on(t.period, t.startsOn)],
);

// A title (needed for festival and special editions) and an optional note for all signs, per language
export const horoscopeEditionTranslations = pgTable(
  "horoscope_edition_translations",
  {
    editionId: uuid("edition_id")
      .notNull()
      .references(() => horoscopeEditions.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    title: varchar("title", { length: 200 }),
    intro: text("intro"),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.locale] })],
);

// One sign's reading in one language
export const horoscopeReadings = pgTable(
  "horoscope_readings",
  {
    editionId: uuid("edition_id")
      .notNull()
      .references(() => horoscopeEditions.id, { onDelete: "cascade" }),
    sign: varchar("sign", { length: 16 }).$type<ZodiacSign>().notNull(),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    overview: text("overview").notNull(),
    career: text("career"),
    finance: text("finance"),
    relationships: text("relationships"),
    health: text("health"),
    spiritual: text("spiritual"),
    lucky: varchar("lucky", { length: 300 }),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.sign, t.locale] })],
);

// Astrology consultations and pujas. Each one has its own page; price and duration are set in the admin.
export const serviceCategories = ["astrology", "puja"] as const;
export type ServiceCategory = (typeof serviceCategories)[number];

// How a service can be done: at the temple/office, at the family's home, over the phone, or on Zoom
export const serviceModes = ["in_person", "home_visit", "phone", "zoom"] as const;
export type ServiceMode = (typeof serviceModes)[number];

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  category: varchar("category", { length: 16 }).$type<ServiceCategory>().notNull(),
  status: varchar("status", { length: 16 }).$type<"draft" | "published">().notNull().default("draft"),
  // Lower numbers are listed first within their category
  sortOrder: integer("sort_order").notNull().default(0),
  // US dollars in cents; empty means "ask for the price"
  priceCents: integer("price_cents"),
  // Shows "From $51" instead of "$51" when the final price depends on the details
  priceFrom: boolean("price_from").notNull().default(false),
  durationMinutes: integer("duration_minutes"),
  modes: jsonb("modes").$type<ServiceMode[]>().notNull().default([]),
  // Off shows "Not taking requests right now" instead of the request button
  bookingOpen: boolean("booking_open").notNull().default(true),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Name and every piece of descriptive writing per site language
export const serviceTranslations = pgTable(
  "service_translations",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>().notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    summary: varchar("summary", { length: 300 }),
    description: text("description"),
    purpose: text("purpose"),
    requirements: text("requirements"),
    location: varchar("location", { length: 300 }),
    availability: varchar("availability", { length: 300 }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.locale] })],
);

export type Service = typeof services.$inferSelect;

// When Guruji takes consultations, in US Central time. Two windows on one day leave a break between them.
export const scheduleWindows = pgTable("schedule_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 0 = Sunday … 6 = Saturday
  weekday: integer("weekday").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});

// One row of booking rules, edited in the admin
export const bookingSettings = pgTable("booking_settings", {
  id: integer("id").primaryKey().default(1),
  // Offered start times are this many minutes apart
  slotStepMinutes: integer("slot_step_minutes").notNull().default(30),
  // For services with no length set
  defaultDurationMinutes: integer("default_duration_minutes").notNull().default(60),
  // Free time kept between two consultations
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  // Empty means no daily limit
  maxPerDay: integer("max_per_day"),
  // How far ahead visitors must book, and how far ahead they can
  minNoticeHours: integer("min_notice_hours").notNull().default(24),
  maxDaysAhead: integer("max_days_ahead").notNull().default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingSettings = typeof bookingSettings.$inferSelect;

// Holidays and other days with no bookings at all
export const blockedDates = pgTable("blocked_dates", {
  date: date("date").primaryKey(),
  reason: varchar("reason", { length: 200 }),
});

// Consultations take an open time from the schedule; pujas are requests for a preferred date and time
export const appointmentKinds = ["consultation", "puja"] as const;
export type AppointmentKind = (typeof appointmentKinds)[number];

export const appointmentStatuses = ["requested", "confirmed", "rescheduled", "cancelled", "completed", "no_show"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];
// These still hold their time on the schedule
export const activeStatuses = ["requested", "confirmed", "rescheduled"] as const satisfies readonly AppointmentStatus[];

// Language the visitor wants to talk in
export const appointmentLanguages = ["en", "ne", "hi", "sa"] as const;
export type AppointmentLanguage = (typeof appointmentLanguages)[number];

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short code people can quote, like AS-7K3QPM
    reference: varchar("reference", { length: 16 }).notNull().unique(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    // Copied at booking time, so the booking still reads right if the service changes
    serviceName: varchar("service_name", { length: 200 }).notNull(),
    kind: varchar("kind", { length: 16 }).$type<AppointmentKind>().notNull(),
    // US Central date and start time
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents"),
    mode: varchar("mode", { length: 16 }).$type<ServiceMode>().notNull(),
    language: varchar("language", { length: 8 }).$type<AppointmentLanguage>().notNull(),
    status: varchar("status", { length: 16 }).$type<AppointmentStatus>().notNull().default("requested"),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    // Where a home visit or puja happens
    address: varchar("address", { length: 300 }),
    gotra: varchar("gotra", { length: 100 }),
    familyNames: text("family_names"),
    notes: text("notes"),
    // Zoom or other meeting link, added by the admin
    meetingLink: varchar("meeting_link", { length: 500 }),
    // Set when the website made the Zoom meeting itself, so it can move or delete it
    zoomMeetingId: varchar("zoom_meeting_id", { length: 32 }),
    adminNote: text("admin_note"),
    // When the day-before reminder went out; cleared when the booking moves
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    locale: varchar("locale", { length: 8 }).$type<ContentLocale>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointments_date_idx").on(t.date)],
);

export type Appointment = typeof appointments.$inferSelect;

// One row per page a visitor opens. No cookies and no IP addresses: "visitor" is a hash that
// changes every day, so it counts people for a day without being able to follow anyone.
export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    // US Central date, so "today" matches the admin's day
    day: date("day").notNull(),
    path: varchar("path", { length: 300 }).notNull(),
    locale: varchar("locale", { length: 8 }),
    // The other website the visitor came from, host name only
    referrer: varchar("referrer", { length: 200 }),
    device: varchar("device", { length: 8 }).$type<"mobile" | "tablet" | "desktop">().notNull(),
    visitor: varchar("visitor", { length: 16 }).notNull(),
  },
  (t) => [index("page_views_day_idx").on(t.day)],
);
