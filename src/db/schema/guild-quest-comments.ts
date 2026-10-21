// Esquema de guild_quest_comments — hilo plano de comentarios de una quest de
// GUILD. Las quests personales (guildId NULL) no tienen comentarios: lo impiden
// los handlers, no el esquema, porque el guild se deriva siempre vía `quests`.
import { relations, sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'
import { quests } from './quests'

// Tabla de comentarios de quests de guild
export const guildQuestComments = pgTable(
  'guild_quest_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Quest comentada. CASCADE: el hilo muere con la quest — y, por la cascada
    // `quests.guild_id`, también con el guild. NO se desnormaliza `guild_id`
    // aquí (a diferencia de la bitácora): el guild se deriva de la quest, así
    // que esta tabla no añade ninguna arista hacia `guilds` ni al orden de
    // bloqueos de su borrado.
    questId: uuid('quest_id')
      .notNull()
      .references(() => quests.id, { onDelete: 'cascade' }),
    // Autor. SET NULL: el comentario sobrevive al borrado de la cuenta y se
    // muestra como "Unknown user"; un comentario huérfano solo lo borra el Guild
    // Master. Salir del guild o ser expulsado no toca esta columna.
    authorId: text('author_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    // Precisión de milisegundos (3) a propósito: un `Date` de JS hace el viaje
    // de ida y vuelta exacto, así que el cursor (created_at, id) que el cliente
    // devuelve nunca pierde los microsegundos que `now()` guardaría por defecto.
    //
    // `clock_timestamp()` y no `now()`: `now()` es el inicio de la TRANSACCIÓN,
    // y las publicaciones se serializan sobre `quests FOR UPDATE`. Un comentario
    // que esperó el bloqueo quedaría fechado antes que otro confirmado mientras
    // esperaba, y el hilo los mostraría en orden inverso al real.
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .notNull()
      .default(sql`clock_timestamp()`),
    // Momento de la última edición del cuerpo; NULL = nunca editado. Sin
    // historial de versiones: solo alimenta la marca "edited" de la UI.
    editedAt: timestamp('edited_at', { withTimezone: true, precision: 3 }),
  },
  // Índice del hilo: filtra por quest y recorre (created_at, id) en el mismo
  // orden que la paginación por cursor.
  (table) => [
    index('guild_quest_comments_quest_id_created_at_id_idx').on(
      table.questId,
      table.createdAt,
      table.id,
    ),
  ],
)

// Relación belongs-to hacia la quest, siguiendo la bitácora. Sin relación hacia
// el autor ni back-relation desde `quests`, igual que la bitácora: los lectores
// hacen sus JOINs explícitos y la app no usa la API relacional de Drizzle.
export const guildQuestCommentsRelations = relations(
  guildQuestComments,
  ({ one }) => ({
    quest: one(quests, {
      fields: [guildQuestComments.questId],
      references: [quests.id],
    }),
  }),
)

// Tipos inferidos para uso en la aplicación
export type GuildQuestComment = typeof guildQuestComments.$inferSelect
export type NewGuildQuestComment = typeof guildQuestComments.$inferInsert
