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
  // código de invitación corto, generado automáticamente al crear el guild
  inviteCode: text('invite_code').notNull().unique(),
  description: text('description'),
  // Seed determinístico (= id del guild) usado para generar el escudo de
  // armas vía la Armoria API — se guarda aunque coatOfArmsSvg falle, para
  // poder reintentar la generación más adelante sin perder el resultado esperado.
  coatOfArmsSeed: text('coat_of_arms_seed'),
  // SVG del escudo de armas, generado una sola vez al crear el guild y
  // persistido aquí — la app nunca depende de la Armoria API después de la
  // creación (ver CLAUDE.md / decisión de Path B sobre disponibilidad del servicio).
  coatOfArmsSvg: text('coat_of_arms_svg'),
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
