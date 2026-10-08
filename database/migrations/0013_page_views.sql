CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"day" date NOT NULL,
	"path" varchar(300) NOT NULL,
	"locale" varchar(8),
	"referrer" varchar(200),
	"device" varchar(8) NOT NULL,
	"visitor" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");