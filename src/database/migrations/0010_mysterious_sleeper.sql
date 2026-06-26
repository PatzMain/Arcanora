CREATE TABLE "dungeon_leaderboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"dungeon_id" varchar(32) NOT NULL,
	"floor" integer NOT NULL,
	"time_taken" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dungeon_leaderboard" ADD CONSTRAINT "dungeon_leaderboard_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dungeon_leaderboard_floor_time_idx" ON "dungeon_leaderboard" USING btree ("dungeon_id","floor","time_taken");