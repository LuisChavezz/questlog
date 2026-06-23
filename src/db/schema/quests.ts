// Esquema de quests — tabla principal de la aplicación
import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'

// Enum: estado de la quest
export const questStatusEnum = pgEnum('quest_status', [
  'backlog',
  'todo',
  'in_progress',
  'done',
  'cancelled',
])

// Enum: prioridad de la quest
export const questPriorityEnum = pgEnum('quest_priority', [
  'low',
  'medium',
  'high',
  'critical',
])

// Tabla de quests
export const quests = pgTable('quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: questStatusEnum('status').notNull().default('backlog'),
  priority: questPriorityEnum('priority').notNull().default('medium'),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// Tipos inferidos para uso en la aplicación
export type Quest = typeof quests.$inferSelect
export type NewQuest = typeof quests.$inferInsert
export type QuestStatus = (typeof questStatusEnum.enumValues)[number]
export type QuestPriority = (typeof questPriorityEnum.enumValues)[number]
