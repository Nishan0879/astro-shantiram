CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"place" varchar(80),
	"email" varchar(254) NOT NULL,
	"rating" smallint NOT NULL,
	"service" varchar(120),
	"message" text NOT NULL,
	"locale" varchar(8),
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "testimonials_status_idx" ON "testimonials" USING btree ("status");