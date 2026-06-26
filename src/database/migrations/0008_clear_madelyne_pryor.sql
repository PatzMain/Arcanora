CREATE TABLE "player_farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"plot_index" integer NOT NULL,
	"crop_id" varchar(32),
	"planted_at" timestamp with time zone,
	"watered_at" timestamp with time zone,
	"harvestable_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "housing_tier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_rest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rest_type" varchar(32) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_farms" ADD CONSTRAINT "player_farms_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;