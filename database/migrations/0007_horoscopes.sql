CREATE TABLE "horoscope_edition_translations" (
	"edition_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" varchar(200),
	"intro" text,
	CONSTRAINT "horoscope_edition_translations_edition_id_locale_pk" PRIMARY KEY("edition_id","locale")
);
--> statement-breakpoint
CREATE TABLE "horoscope_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" varchar(16) NOT NULL,
	"starts_on" date NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horoscope_readings" (
	"edition_id" uuid NOT NULL,
	"sign" varchar(16) NOT NULL,
	"locale" varchar(8) NOT NULL,
	"overview" text NOT NULL,
	"career" text,
	"finance" text,
	"relationships" text,
	"health" text,
	"spiritual" text,
	"lucky" varchar(300),
	CONSTRAINT "horoscope_readings_edition_id_sign_locale_pk" PRIMARY KEY("edition_id","sign","locale")
);
--> statement-breakpoint
ALTER TABLE "horoscope_edition_translations" ADD CONSTRAINT "horoscope_edition_translations_edition_id_horoscope_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."horoscope_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horoscope_readings" ADD CONSTRAINT "horoscope_readings_edition_id_horoscope_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."horoscope_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "horoscope_editions_period_starts_on_idx" ON "horoscope_editions" USING btree ("period","starts_on");