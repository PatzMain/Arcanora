CREATE TABLE "boss_participants" (
	"boss_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"damage_dealt" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"enemy_id" varchar(64) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"state" jsonb NOT NULL,
	"message_id" varchar(20),
	"channel_id" varchar(20),
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "combat_sessions_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "cooldowns" (
	"player_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logins" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_claim" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guild_members" (
	"guild_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"rank" varchar(16) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(32) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"exp" bigint DEFAULT 0 NOT NULL,
	"treasury" bigint DEFAULT 0 NOT NULL,
	"leader_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"durability" integer,
	"enhancement" integer DEFAULT 0 NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"achievement_id" varchar(64) NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_equipment" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"weapon" uuid,
	"helmet" uuid,
	"chest" uuid,
	"gloves" uuid,
	"boots" uuid,
	"accessory" uuid,
	"pet" uuid
);
--> statement-breakpoint
CREATE TABLE "player_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"quest_id" varchar(64) NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "player_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"skill_id" varchar(64) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"hp_max" integer DEFAULT 100 NOT NULL,
	"mana_max" integer DEFAULT 50 NOT NULL,
	"attack" integer DEFAULT 10 NOT NULL,
	"defense" integer DEFAULT 5 NOT NULL,
	"crit_chance" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"crit_dmg" numeric(5, 2) DEFAULT '150.00' NOT NULL,
	"speed" integer DEFAULT 10 NOT NULL,
	"luck" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" varchar(20) NOT NULL,
	"username" varchar(32) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"exp" bigint DEFAULT 0 NOT NULL,
	"gold" bigint DEFAULT 500 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"prestige" integer DEFAULT 0 NOT NULL,
	"class" varchar(20) DEFAULT 'novice' NOT NULL,
	"hp_current" integer DEFAULT 100 NOT NULL,
	"mana_current" integer DEFAULT 50 NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"total_quests_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone,
	CONSTRAINT "players_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'gold' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_bosses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"boss_id" varchar(64) NOT NULL,
	"hp_current" bigint NOT NULL,
	"hp_max" bigint NOT NULL,
	"spawned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"defeated_at" timestamp with time zone,
	"channel_id" varchar(20),
	"message_id" varchar(20)
);
--> statement-breakpoint
ALTER TABLE "boss_participants" ADD CONSTRAINT "boss_participants_boss_id_world_bosses_id_fk" FOREIGN KEY ("boss_id") REFERENCES "public"."world_bosses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_participants" ADD CONSTRAINT "boss_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat_sessions" ADD CONSTRAINT "combat_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logins" ADD CONSTRAINT "daily_logins_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_leader_id_players_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_weapon_inventory_id_fk" FOREIGN KEY ("weapon") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_helmet_inventory_id_fk" FOREIGN KEY ("helmet") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_chest_inventory_id_fk" FOREIGN KEY ("chest") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_gloves_inventory_id_fk" FOREIGN KEY ("gloves") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_boots_inventory_id_fk" FOREIGN KEY ("boots") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_accessory_inventory_id_fk" FOREIGN KEY ("accessory") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_equipment" ADD CONSTRAINT "player_equipment_pet_inventory_id_fk" FOREIGN KEY ("pet") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_quests" ADD CONSTRAINT "player_quests_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boss_participants_pk" ON "boss_participants" USING btree ("boss_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cooldowns_pk" ON "cooldowns" USING btree ("player_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_members_pk" ON "guild_members" USING btree ("guild_id","player_id");--> statement-breakpoint
CREATE INDEX "inventory_player_item_idx" ON "inventory" USING btree ("player_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_achievements_idx" ON "player_achievements" USING btree ("player_id","achievement_id");--> statement-breakpoint
CREATE INDEX "player_quests_player_quest_idx" ON "player_quests" USING btree ("player_id","quest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_skills_idx" ON "player_skills" USING btree ("player_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_discord_id_idx" ON "players" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "players_level_exp_idx" ON "players" USING btree ("level","exp");--> statement-breakpoint
CREATE INDEX "transactions_player_date_idx" ON "transactions" USING btree ("player_id","created_at");