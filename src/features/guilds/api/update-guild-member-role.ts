// Función de servidor — cambia el rol de un miembro (member ↔ admin).
// Solo el owner del guild puede hacerlo; el rol del owner es inmutable aquí.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers } from '#/db/schema'
import { auth } from '#/lib/auth'
import { isGuildOwner } from '../role-labels'
import { updateGuildMemberRoleSchema } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export const updateGuildMemberRole = createServerFn({ method: 'POST' })
  .inputValidator(updateGuildMemberRoleSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    // Localizar el guild y su dueño estructural (guilds.owner_id)
    const guild = await resolveGuildBySlugOrThrow(data.slug)

    // Autorización estructural: solo el owner puede cambiar roles. Se verifica
    // contra guilds.owner_id, no contra guild_members.role, porque la propiedad
    // del guild es estructural. Mismo predicado `isGuildOwner` que la UI, para
    // que servidor y cliente no puedan discrepar sobre quién es el dueño.
    if (!isGuildOwner(guild.ownerId, session.user.id)) {
      throw new Error('Forbidden: only the guild owner can change member roles')
    }

    // El rol del owner nunca se cambia por este endpoint (es estructural; para
    // cederlo existiría una feature aparte de "transferir propiedad").
    if (isGuildOwner(guild.ownerId, data.userId)) {
      throw new Error("Forbidden: the guild owner's role cannot be changed")
    }

    // Actualizar el rol del miembro objetivo. returning() confirma que la fila
    // existía; si no, el usuario no es miembro de este guild.
    const updated = await db
      .update(guildMembers)
      .set({ role: data.newRole })
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          eq(guildMembers.userId, data.userId),
        ),
      )
      .returning({ id: guildMembers.id })

    if (updated.length === 0) {
      throw new Error('Not Found: member not found in this guild')
    }

    return { userId: data.userId, role: data.newRole }
  })
