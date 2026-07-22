// Función de servidor PÚBLICA — previsualiza una invitación a partir de su código.
// No requiere sesión: lee la sesión sin lanzar (a diferencia del resto de server
// fns) solo para indicar al loader qué rama de UI mostrar. Nunca expone datos
// privados de otros miembros (emails, roles, ids, lista completa).
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, count, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { toMemberWithInitials } from './member-shaping'
import { getGuildInvitePreviewSchema } from '../schemas/guild-schemas'

// Avatares visibles en la tarjeta de invitación antes del contador "+N"
const MAX_PREVIEW_AVATARS = 5

export const getGuildInvitePreview = createServerFn({ method: 'GET' })
  .inputValidator(getGuildInvitePreviewSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    // Sesión sin lanzar: el visitante puede no estar autenticado
    const session = await auth.api.getSession({ headers: request.headers })
    const isAuthenticated = Boolean(session?.user.id)

    // Búsqueda pública del guild por su invite code
    const guildsFound = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        slug: guilds.slug,
        description: guilds.description,
      })
      .from(guilds)
      .where(eq(guilds.inviteCode, data.code))
      .limit(1)

    // Código inválido/expirado: devolvemos el estado del visitante para que el
    // loader pueda enlazar la pantalla de error según esté o no autenticado.
    if (guildsFound.length === 0) {
      return { guild: null, viewer: { isAuthenticated, isMember: false } }
    }

    const guild = guildsFound[0]

    // Conteo total + primeros N miembros (solo iniciales/avatar) + membresía propia
    const [countResult, previewMembers, ownMembership] = await Promise.all([
      db
        .select({ count: count() })
        .from(guildMembers)
        .where(eq(guildMembers.guildId, guild.id)),
      db
        .select({
          name: user.name,
          email: user.email,
          image: user.image,
          avatarId: user.avatarId,
        })
        .from(guildMembers)
        .innerJoin(user, eq(guildMembers.userId, user.id))
        .where(eq(guildMembers.guildId, guild.id))
        .orderBy(asc(guildMembers.joinedAt))
        .limit(MAX_PREVIEW_AVATARS),
      session?.user.id
        ? db
            .select({ id: guildMembers.id })
            .from(guildMembers)
            .where(
              and(
                eq(guildMembers.guildId, guild.id),
                eq(guildMembers.userId, session.user.id),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ])

    const memberCount = countResult[0]?.count ?? 0

    return {
      guild: {
        name: guild.name,
        slug: guild.slug,
        description: guild.description,
        memberCount,
        // Solo datos públicos: iniciales + imagen. Sin nombres completos,
        // ids, emails ni roles de los demás miembros — el helper ya retira el
        // email y deriva las iniciales; el pick explícito descarta el resto.
        members: previewMembers.map((m) => {
          const { image, avatarId, initials } = toMemberWithInitials(m)
          return { image, avatarId, initials }
        }),
      },
      viewer: {
        isAuthenticated,
        isMember: ownMembership.length > 0,
      },
    }
  })

// Tarjeta de invitación de un guild existente (rama `guild !== null`)
export type GuildInvitePreview = NonNullable<
  Awaited<ReturnType<typeof getGuildInvitePreview>>['guild']
>
