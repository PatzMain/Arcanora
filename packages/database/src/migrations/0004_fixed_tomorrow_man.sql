CREATE TABLE "exploration_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"current_node_id" varchar(32) NOT NULL,
	"previous_node_id" varchar(32),
	"party" jsonb DEFAULT '{"leaderId":"","members":[]}'::jsonb NOT NULL,
	"map_state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stamina" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stamina_max" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_stamina_regen" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "exploration_sessions" ADD CONSTRAINT "exploration_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;