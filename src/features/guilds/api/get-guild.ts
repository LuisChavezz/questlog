// Función de servidor — obtiene el detalle completo de un guild por slug
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, count, desc, eq, gte, notInArray } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { getGuildInputSchema } from '../schemas/guild-schemas'

export const getGuild = createServerFn({ method: 'GET' })
  .inputValidator(getGuildInputSchema)
  .handler(async ({ data: input }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to view guild details')
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

    // Paso 2: verificar membresía y obtener rol del usuario actual
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

    const { role: currentUserRole } = memberships[0]

    // Inicio de la semana actual (lunes a las 00:00:00 UTC)
    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7))
    inicioSemana.setUTCHours(0, 0, 0, 0)

    // Paso 3: stats, miembros y actividad reciente en paralelo
    const [statsResult, membersResult, recentActivityResult] = await Promise.all([
      // Stats: tres conteos de quests
      Promise.all([
        db
          .select({ count: count() })
          .from(quests)
          .where(
            and(
              eq(quests.guildId, guild.id),
              notInArray(quests.status, ['done', 'cancelled']),
            ),
          ),
        db
          .select({ count: count() })
          .from(quests)
          .where(
            and(
              eq(quests.guildId, guild.id),
              eq(quests.status, 'in_progress'),
            ),
          ),
        db
          .select({ count: count() })
          .from(quests)
          .where(
            and(
              eq(quests.guildId, guild.id),
              eq(quests.status, 'done'),
              gte(quests.updatedAt, inicioSemana),
            ),
          ),
      ]),
      // Miembros: guild_members JOIN users
      db
        .select({
          id: guildMembers.id,
          userId: guildMembers.userId,
          name: user.name,
          image: user.image,
          avatarId: user.avatarId,
          role: guildMembers.role,
          joinedAt: guildMembers.joinedAt,
        })
        .from(guildMembers)
        .innerJoin(user, eq(guildMembers.userId, user.id))
        .where(eq(guildMembers.guildId, guild.id))
        .orderBy(asc(guildMembers.joinedAt)),
      // Actividad reciente: últimas 5 quests ordenadas por fecha de actualización
      db
        .select({
          id: quests.id,
          title: quests.title,
          status: quests.status,
          updatedAt: quests.updatedAt,
        })
        .from(quests)
        .where(eq(quests.guildId, guild.id))
        .orderBy(desc(quests.updatedAt))
        .limit(5),
    ])

    // COUNT() siempre devuelve exactamente una fila — desestructuración directa
    const [[activeRow], [inProgressRow], [completedWeekRow]] = statsResult

    return {
      guild,
      currentUserRole,
      stats: {
        activeCount: activeRow.count,
        inProgressCount: inProgressRow.count,
        completedThisWeekCount: completedWeekRow.count,
      },
      // Iniciales como fallback del avatar: primera letra de cada palabra (máx. 2)
      members: membersResult.map((m) => ({
        ...m,
        initials: m.name
          .split(' ')
          .slice(0, 2)
          .map((w) => w.charAt(0).toUpperCase())
          .join(''),
      })),
      recentActivity: recentActivityResult,
    }
  })

export type GuildDetail = Awaited<ReturnType<typeof getGuild>>
