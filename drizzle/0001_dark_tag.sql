CREATE TYPE "public"."quest_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('backlog', 'todo', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "quest_status" DEFAULT 'backlog' NOT NULL,
	"priority" "quest_priority" DEFAULT 'medium' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
DROP TYPE "public"."task_priority";--> statement-breakpoint
DROP TYPE "public"."task_status";