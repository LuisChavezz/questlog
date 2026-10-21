CREATE TABLE "guild_quest_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp (3) with time zone
);
--> statement-breakpoint
ALTER TABLE "guild_quest_comments" ADD CONSTRAINT "guild_quest_comments_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_quest_comments" ADD CONSTRAINT "guild_quest_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_quest_comments_quest_id_created_at_id_idx" ON "guild_quest_comments" USING btree ("quest_id","created_at","id");