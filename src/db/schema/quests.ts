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
  // Guild al que pertenece la quest; NULL = quest personal.
  // CASCADE a propósito: borrar un guild borra sus quests, NO las convierte en
  // personales. Un `set null` reasignaría en silencio quests de guild a la lista
  // personal de su creador —con asignado/supervisor de un guild que ya no
  // existe—, así que la quest muere con el guild. De esta cascada cuelga a su vez
  // la de `guild_quest_activity_log.quest_id`, que ya era CASCADE: la bitácora de
  // cada quest se va con ella (ver el comentario de esa columna).
  guildId: text('guild_id').references(() => guilds.id, {
    onDelete: 'cascade',
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
