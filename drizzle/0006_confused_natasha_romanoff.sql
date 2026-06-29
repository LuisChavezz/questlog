ALTER TABLE "quests" RENAME COLUMN "user_id" TO "owner_id";--> statement-breakpoint
ALTER TABLE "quests" DROP CONSTRAINT "quests_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "supervisor_id" text;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "guild_id" text;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_supervisor_id_user_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE set null ON UPDATE no action;