CREATE TABLE "custom_assets" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"type" varchar(32) NOT NULL,
	"emoji" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
