CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(8) NOT NULL,
	"category" varchar(32) NOT NULL,
	"url" varchar(500) NOT NULL,
	"public_id" varchar(300),
	"width" integer,
	"height" integer,
	"captions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "cover_url" varchar(500);