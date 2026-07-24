// Esquema de guild_quest_activity_log — bitácora de auditoría de quests de GUILD.
// Registra la creación de la quest y el cambio de campos concretos (status,
// assigneeId, supervisorId, dueDate). Las quests personales (guildId NULL) NUNCA
// escriben aquí, y el borrado NO se registra: las filas mueren con la quest vía
// la cascada de `quest_id` (ver comentario en esa columna).
import { relations } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'
import { guilds } from './guilds'
import { quests } from './quests'

// Enum: tipo de evento registrado. `created` = alta de la quest; `field_updated`
// = un campo rastreado cambió (una fila por campo).
export const guildQuestActivityEventTypeEnum = pgEnum(
  'guild_quest_activity_event_type',
  ['created', 'field_updated'],
)

// Campos cuyo cambio se audita. Se guarda como texto en la columna `field`
// (según lo pedido), pero se tipa con esta unión para que el lado TS sea la
// fuente de verdad de qué campos son válidos — usa el NOMBRE del campo del
// payload (camelCase), no el de la columna de BD.
export type GuildQuestActivityField =
  | 'status'
  | 'assigneeId'
  | 'supervisorId'
  | 'dueDate'

// Tabla de bitácora de actividad de quests de guild
export const guildQuestActivityLog = pgTable('guild_quest_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Quest a la que pertenece el evento. CASCADE a propósito: la historia muere
  // con la quest — no queremos conservar rastro del borrado (por eso tampoco se
  // registra un evento de borrado en ningún lado que lo compense).
  questId: uuid('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
  // Guild de la quest, desnormalizado a propósito para consultar la bitácora por
  // guild sin pasar por `quests` (mismo motivo por el que `quests.guild_id`
  // existe junto a `quests.owner_id`). CASCADE: se va con el guild.
  guildId: text('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  // Usuario que ejecutó la acción. SET NULL: si su cuenta se borra después, la
  // fila de bitácora sobrevive con actor desconocido — no se cascadea. Solo se
  // guarda el FK; resolver el actor a un nombre/avatar es cosa de la futura UI.
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  eventType: guildQuestActivityEventTypeEnum('event_type').notNull(),
  // Campo cambiado (solo para `field_updated`); NULL cuando `event_type` =
  // `created`. Texto en BD, tipado con la unión de campos rastreados.
  field: text('field').$type<GuildQuestActivityField>(),
  // Valor previo/nuevo como texto crudo (NULL en `created`): status como string
  // del enum, assignee/supervisor como id de usuario, dueDate como string ISO.
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Relaciones (lado belongs-to) hacia quest y guild, siguiendo la convención de
// guild_members. NO se define relación hacia el actor a propósito: resolver su
// identidad es una preocupación futura de la UI, no algo que la bitácora modele.
export const guildQuestActivityLogRelations = relations(
  guildQuestActivityLog,
  ({ one }) => ({
    quest: one(quests, {
      fields: [guildQuestActivityLog.questId],
      references: [quests.id],
    }),
    guild: one(guilds, {
      fields: [guildQuestActivityLog.guildId],
      references: [guilds.id],
    }),
  }),
)

// Tipos inferidos para uso en la aplicación
export type GuildQuestActivityLog = typeof guildQuestActivityLog.$inferSelect
export type NewGuildQuestActivityLog = typeof guildQuestActivityLog.$inferInsert
export type GuildQuestActivityEventType =
  (typeof guildQuestActivityEventTypeEnum.enumValues)[number]
