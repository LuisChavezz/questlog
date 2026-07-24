CREATE TYPE "public"."guild_quest_activity_event_type" AS ENUM('created', 'field_updated');--> statement-breakpoint
CREATE TABLE "guild_quest_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"actor_id" text,
	"event_type" "guild_quest_activity_event_type" NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_quest_activity_log" ADD CONSTRAINT "guild_quest_activity_log_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_quest_activity_log" ADD CONSTRAINT "guild_quest_activity_log_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_quest_activity_log" ADD CONSTRAINT "guild_quest_activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;