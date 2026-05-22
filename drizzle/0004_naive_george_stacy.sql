ALTER TABLE "quests" ALTER COLUMN "priority" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "priority" SET DEFAULT 'medium'::text;--> statement-breakpoint
DROP TYPE "public"."quest_priority";--> statement-breakpoint
CREATE TYPE "public"."quest_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
UPDATE "quests" SET "priority" = 'critical' WHERE "priority" = 'urgent';--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "priority" SET DEFAULT 'medium'::"public"."quest_priority";--> statement-breakpoint
ALTER TABLE "quests" ALTER COLUMN "priority" SET DATA TYPE "public"."quest_priority" USING "priority"::"public"."quest_priority";