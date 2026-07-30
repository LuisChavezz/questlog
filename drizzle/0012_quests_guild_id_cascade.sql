ALTER TABLE "quests" DROP CONSTRAINT "quests_guild_id_guilds_id_fk";
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;