CREATE TABLE "book_translations" (
	"book_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" varchar(200) NOT NULL,
	"author" varchar(200),
	"description" text,
	CONSTRAINT "book_translations_book_id_locale_pk" PRIMARY KEY("book_id","locale")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"category" varchar(32) NOT NULL,
	"language" varchar(8) NOT NULL,
	"published_on" date,
	"featured" boolean DEFAULT false NOT NULL,
	"pdf_url" varchar(500) NOT NULL,
	"pdf_public_id" varchar(300),
	"page_count" integer,
	"cover_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "book_translations" ADD CONSTRAINT "book_translations_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;