CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(40),
	"category" varchar(32) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"locale" varchar(8),
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
