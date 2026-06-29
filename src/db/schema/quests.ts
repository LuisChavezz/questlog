// Esquema de quests — tabla principal de la aplicación
import { relations, sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'
import { guilds } from './guilds'

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
  // Creador de la quest (obligatorio)
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Usuario al que se asigna la quest (opcional)
  assigneeId: text('assignee_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  // Usuario que supervisa la quest (opcional)
  supervisorId: text('supervisor_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  // Guild al que pertenece la quest; NULL = quest personal
  guildId: text('guild_id').references(() => guilds.id, {
    onDelete: 'set null',
  }),
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

// Relaciones de quests: dueño, asignado y supervisor (→ user); gremio (→ guilds)
export const questsRelations = relations(quests, ({ one }) => ({
  owner: one(user, {
    fields: [quests.ownerId],
    references: [user.id],
    relationName: 'questOwner',
  }),
  assignee: one(user, {
    fields: [quests.assigneeId],
    references: [user.id],
    relationName: 'questAssignee',
  }),
  supervisor: one(user, {
    fields: [quests.supervisorId],
    references: [user.id],
    relationName: 'questSupervisor',
  }),
  guild: one(guilds, {
    fields: [quests.guildId],
    references: [guilds.id],
  }),
}))

// Tipos inferidos para uso en la aplicación
export type Quest = typeof quests.$inferSelect
export type NewQuest = typeof quests.$inferInsert
export type QuestStatus = (typeof questStatusEnum.enumValues)[number]
export type QuestPriority = (typeof questPriorityEnum.enumValues)[number]
