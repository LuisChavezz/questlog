// Esquema de guilds — gremios que agrupan usuarios bajo un dueño
import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { user } from '../auth-schema'
import { guildMembers } from './guild-members'

// Tabla de guilds
export const guilds = pgTable('guilds', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  // slug único usado en URLs: /guilds/dev-guild
  slug: text('slug').notNull().unique(),
  description: text('description'),
  // dueño/fundador del guild — se replica la convención de cascada de quests
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

// Relaciones de guilds: dueño (user) y miembros (guild_members)
export const guildsRelations = relations(guilds, ({ one, many }) => ({
  owner: one(user, {
    fields: [guilds.ownerId],
    references: [user.id],
  }),
  members: many(guildMembers),
}))

// Tipos inferidos para uso en la aplicación
export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert
