CREATE TABLE "video_translations" (
	"video_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	CONSTRAINT "video_translations_video_id_locale_pk" PRIMARY KEY("video_id","locale")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_id" varchar(20) NOT NULL,
	"kind" varchar(8) DEFAULT 'video' NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"category" varchar(32) NOT NULL,
	"language" varchar(8) NOT NULL,
	"published_on" date,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_youtube_id_unique" UNIQUE("youtube_id")
);
--> statement-breakpoint
ALTER TABLE "video_translations" ADD CONSTRAINT "video_translations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;