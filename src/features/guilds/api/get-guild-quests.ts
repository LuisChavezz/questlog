// Función de servidor — obtiene todas las quests de un guild específico
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import { getGuildInputSchema } from '../schemas/guild-schemas'

export const getGuildQuests = createServerFn({ method: 'GET' })
  .inputValidator(getGuildInputSchema)
  .handler(async ({ data: input }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to view guild quests')
    }

    // Paso 1: buscar el guild por slug
    const guildsFound = await db
      .select()
      .from(guilds)
      .where(eq(guilds.slug, input.slug))
      .limit(1)

    if (guildsFound.length === 0) {
      throw new Error('Not Found: guild not found')
    }

    const guild = guildsFound[0]

    // Paso 2: verificar membresía — puerta de autorización, no filtro de datos
    const memberships = await db
      .select({ role: guildMembers.role })
      .from(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          eq(guildMembers.userId, session.user.id),
        ),
      )
      .limit(1)

    if (memberships.length === 0) {
      throw new Error('Forbidden: you are not a member of this guild')
    }

    // Paso 3: retornar todas las quests del guild sin filtrar por rol individual
    return db
      .select()
      .from(quests)
      .where(eq(quests.guildId, guild.id))
      .orderBy(asc(quests.createdAt))
  })
