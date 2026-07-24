// Función de servidor — obtiene los guilds a los que pertenece el usuario autenticado
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { asc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import { auth } from '#/lib/auth'

export const getGuilds = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user.id) {
    throw new Error('Unauthorized: must be signed in to fetch guilds')
  }

  // JOIN de guild_members → guilds: trae los guilds del usuario junto con su rol
  const result = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      slug: guilds.slug,
      description: guilds.description,
      coatOfArmsSvg: guilds.coatOfArmsSvg,
      ownerId: guilds.ownerId,
      createdAt: guilds.createdAt,
      updatedAt: guilds.updatedAt,
      role: guildMembers.role,
    })
    .from(guildMembers)
    .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
    .where(eq(guildMembers.userId, session.user.id))
    .orderBy(asc(guilds.createdAt))

  return result
})

// Guild enriquecido con el rol del usuario actual dentro de él
export type GuildWithRole = Awaited<ReturnType<typeof getGuilds>>[number]
