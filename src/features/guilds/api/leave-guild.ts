// Función de servidor — permite a un miembro abandonar un guild voluntariamente.
// El owner no puede abandonar directamente: debe transferir la propiedad antes
// de volverse elegible como miembro normal.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers } from '#/db/schema'
import { auth } from '#/lib/auth'
import { isGuildOwner } from '../role-labels'
import { leaveGuildSchema } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export const leaveGuild = createServerFn({ method: 'POST' })
  .inputValidator(leaveGuildSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    const userId = session.user.id

    // Localizar el guild y su dueño estructural (guilds.owner_id)
    const guild = await resolveGuildBySlugOrThrow(data.slug)

    // El owner debe transferir la propiedad antes de salir. Se verifica contra
    // guilds.owner_id (no contra guild_members.role) para no permitir un bypass
    // por drift — mismo patrón defensivo que transfer-guild-ownership.
    if (isGuildOwner(guild.ownerId, userId)) {
      throw new Error(
        'Forbidden: you must transfer ownership before leaving this guild',
      )
    }

    // Borrar la membresía; returning() confirma que la fila existía. Si no,
    // el usuario no era miembro de este guild.
    const removed = await db
      .delete(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          eq(guildMembers.userId, userId),
        ),
      )
      .returning({ id: guildMembers.id })

    if (removed.length === 0) {
      throw new Error('Forbidden: you are not a member of this guild')
    }

    return { slug: data.slug }
  })
