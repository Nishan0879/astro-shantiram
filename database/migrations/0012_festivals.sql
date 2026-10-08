CREATE TABLE "festival_translations" (
	"festival_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	CONSTRAINT "festival_translations_festival_id_locale_pk" PRIMARY KEY("festival_id","locale")
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"kind" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'published' NOT NULL,
	"service_slug" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "festival_translations" ADD CONSTRAINT "festival_translations_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "festivals_date_idx" ON "festivals" USING btree ("date");