// Acción de servidor — une al usuario autenticado a un guild por su invite code.
// Idempotente: si ya es miembro, devuelve el slug sin error. Solo invocable con
// sesión activa (sigue el patrón estándar de lanzar si no hay autenticación).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import { auth } from '#/lib/auth'
import { joinGuildSchema } from '../schemas/guild-schemas'

export const joinGuild = createServerFn({ method: 'POST' })
  .inputValidator(joinGuildSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to join a guild')
    }

    const userId = session.user.id

    // Validar que el código resuelve a un guild real
    const guildsFound = await db
      .select({ id: guilds.id, slug: guilds.slug })
      .from(guilds)
      .where(eq(guilds.inviteCode, data.code))
      .limit(1)

    if (guildsFound.length === 0) {
      throw new Error('Not Found: invalid invite code')
    }

    const guild = guildsFound[0]

    // Idempotencia: si ya pertenece, devolvemos el slug para que el cliente
    // redirija sin tratarlo como error.
    const existing = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          eq(guildMembers.userId, userId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      return { slug: guild.slug }
    }

    // Insertar la membresía. La constraint UNIQUE(guild_id, user_id) es la red
    // de seguridad ante una carrera de doble inserción: si otra request gana,
    // Postgres lanza 23505 y lo tratamos como éxito idempotente.
    try {
      await db.insert(guildMembers).values({
        guildId: guild.id,
        userId,
        role: 'member',
      })
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === '23505'
      ) {
        return { slug: guild.slug }
      }
      throw err
    }

    return { slug: guild.slug }
  })
