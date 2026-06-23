// Esquema de guild_members — tabla pivote entre guilds y users con rol
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'
import { guilds } from './guilds'

// Enum: rol del miembro dentro del guild
export const guildRoleEnum = pgEnum('guild_role', ['owner', 'admin', 'member'])

// Tabla pivote guild_members
export const guildMembers = pgTable(
  'guild_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    guildId: text('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: guildRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Un usuario solo puede pertenecer una vez a cada guild
  (table) => [unique().on(table.guildId, table.userId)],
)

// Relaciones de guild_members: guild y user a los que pertenece la fila
export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildMembers.guildId],
    references: [guilds.id],
  }),
  user: one(user, {
    fields: [guildMembers.userId],
    references: [user.id],
  }),
}))

// Back-relation de user → guild_members. Se define aquí porque auth-schema.ts
// es propiedad de Better Auth y no debe editarse a mano.
export const userRelations = relations(user, ({ many }) => ({
  guildMemberships: many(guildMembers),
}))

// Tipos inferidos para uso en la aplicación
export type GuildMember = typeof guildMembers.$inferSelect
export type NewGuildMember = typeof guildMembers.$inferInsert
export type GuildRole = (typeof guildRoleEnum.enumValues)[number]
