CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(16) NOT NULL,
	"service_id" uuid,
	"service_name" varchar(200) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer,
	"mode" varchar(16) NOT NULL,
	"language" varchar(8) NOT NULL,
	"status" varchar(16) DEFAULT 'requested' NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"address" varchar(300),
	"gotra" varchar(100),
	"family_names" text,
	"notes" text,
	"meeting_link" varchar(500),
	"admin_note" text,
	"locale" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "blocked_dates" (
	"date" date PRIMARY KEY NOT NULL,
	"reason" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "booking_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_step_minutes" integer DEFAULT 30 NOT NULL,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"max_per_day" integer,
	"min_notice_hours" integer DEFAULT 24 NOT NULL,
	"max_days_ahead" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_date_idx" ON "appointments" USING btree ("date");--> statement-breakpoint
INSERT INTO "booking_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- A starting week (Monday, Tuesday and Thursday evenings), changed in Admin → Schedule
INSERT INTO "schedule_windows" ("weekday", "start_time", "end_time")
SELECT * FROM (VALUES (1, '17:00'::time, '20:00'::time), (2, '18:00'::time, '21:00'::time), (4, '17:00'::time, '20:00'::time)) AS v(weekday, start_time, end_time)
WHERE NOT EXISTS (SELECT 1 FROM "schedule_windows");
