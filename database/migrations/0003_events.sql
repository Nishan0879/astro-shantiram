CREATE TABLE "event_translations" (
	"event_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" varchar(200) NOT NULL,
	"location" varchar(200),
	"description" text,
	CONSTRAINT "event_translations_event_id_locale_pk" PRIMARY KEY("event_id","locale")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"event_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"registration_url" varchar(500),
	"youtube_url" varchar(500),
	"zoom_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_translations" ADD CONSTRAINT "event_translations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;