// Función de servidor — guilds que aportan quests a la lista personal, cada uno
// con su ROSTER COMPLETO.
//
// `/quests` renderiza una tabla independiente por guild, y cada una necesita
// exactamente lo mismo que la tabla de `/guilds/$slug/quests`: los miembros del
// guild (para los selectores y las opciones de filtro de asignado/supervisor),
// el rol del usuario dentro de él y su dueño estructural (para los permisos).
// Nunca se mezclan rosters de guilds distintos: cada tabla recibe el suyo.
//
// Se resuelve en una sola llamada en vez de N × `getGuild(slug)` porque ese
// endpoint además calcula stats y actividad reciente —trabajo que esta pantalla
// no usa— y su caché `['guild', slug]` se invalida con cada edición de quest,
// así que reutilizarlo aquí recargaría todo eso en cada edición inline.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, eq, exists, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '#/db'
import { guildMembers, guilds, quests, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { toMemberWithInitials } from '#/features/guilds/api/member-shaping'
import { buildGuildQuestRoleFilter } from './visible-quests-filter'

export const getQuestGuilds = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to fetch quests')
    }

    const userId = session.user.id

    // Paso 1: guilds del usuario con al menos una quest visible para él. El
    // JOIN sobre `viewerMembership` ya garantiza membresía vigente y fija el
    // guild, así que el subquery de abajo solo necesita el criterio de rol
    // (`buildGuildQuestRoleFilter`) — no el filtro completo de visibilidad,
    // cuya re-verificación de membresía y rama de quests personales serían
    // redundantes en este contexto. El alias mantiene esta referencia a
    // `guild_members` con nombre propio en el SQL generado.
    const viewerMembership = alias(guildMembers, 'viewer_membership')
    const questGuilds = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        slug: guilds.slug,
        ownerId: guilds.ownerId,
        currentUserRole: viewerMembership.role,
      })
      .from(guilds)
      .innerJoin(
        viewerMembership,
        and(
          eq(viewerMembership.guildId, guilds.id),
          eq(viewerMembership.userId, userId),
        ),
      )
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(quests)
            .where(
              and(
                eq(quests.guildId, guilds.id),
                buildGuildQuestRoleFilter(userId),
              ),
            ),
        ),
      )
      .orderBy(asc(guilds.createdAt))

    if (questGuilds.length === 0) {
      return []
    }

    // Paso 2: roster completo de esos guilds, en una sola consulta
    const memberRows = await db
      .select({
        guildId: guildMembers.guildId,
        userId: guildMembers.userId,
        name: user.name,
        email: user.email,
        image: user.image,
        avatarId: user.avatarId,
        role: guildMembers.role,
      })
      .from(guildMembers)
      .innerJoin(user, eq(guildMembers.userId, user.id))
      .where(
        inArray(
          guildMembers.guildId,
          questGuilds.map((guild) => guild.id),
        ),
      )
      .orderBy(asc(guildMembers.joinedAt))

    // El email solo alimenta las iniciales de respaldo del avatar y no se
    // expone al cliente — retirarlo y derivarlas es responsabilidad de
    // `toMemberWithInitials`, el mismo helper que usa `getGuild`.
    const membersByGuildId = new Map<
      string,
      Array<
        Omit<(typeof memberRows)[number], 'guildId' | 'email'> & {
          initials: string
        }
      >
    >()

    for (const { guildId, ...memberRow } of memberRows) {
      const members = membersByGuildId.get(guildId) ?? []
      members.push(toMemberWithInitials(memberRow))
      membersByGuildId.set(guildId, members)
    }

    return questGuilds.map((guild) => ({
      ...guild,
      members: membersByGuildId.get(guild.id) ?? [],
    }))
  },
)

// Guild con su roster, listo para alimentar una tabla de quests de guild
export type QuestGuild = Awaited<ReturnType<typeof getQuestGuilds>>[number]
