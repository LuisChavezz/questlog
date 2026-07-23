// Función de servidor — obtiene el detalle completo de un guild por slug
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, count, desc, eq, gte, lt, notInArray } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { toMemberWithInitials } from './member-shaping'
import { isGuildOwner } from '../role-labels'
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

    // Dueño estructural (guilds.owner_id), no el rol — mismo criterio que
    // transfer-guild-ownership.ts / leave-guild.ts, para no depender de un
    // guild_members.role que ante un drift hipotético permitiría un bypass.
    const isOwner = isGuildOwner(guild.ownerId, session.user.id)

    // Inicio de la semana actual (lunes a las 00:00:00 UTC)
    const inicioSemana = new Date()
    inicioSemana.setDate(
      inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7),
    )
    inicioSemana.setUTCHours(0, 0, 0, 0)

    // Medianoche UTC de hoy. Las fechas de vencimiento se guardan como
    // medianoche UTC, así que una quest está vencida si su fecha es
    // ESTRICTAMENTE anterior a esto — la que vence hoy todavía no cuenta.
    const inicioDeHoy = new Date()
    inicioDeHoy.setUTCHours(0, 0, 0, 0)

    // Paso 3: stats, miembros y actividad reciente en paralelo
    const [statsResult, membersResult, recentActivityResult] =
      await Promise.all([
        // Stats: cuatro conteos de quests
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
          // Vencidas: fecha en el pasado y aún abiertas (misma regla que
          // `isQuestOverdue` en cliente). `lt` sobre una fecha NULL es NULL en
          // SQL —descarta las quests sin fecha—, así que no hace falta un
          // `isNotNull` explícito.
          db
            .select({ count: count() })
            .from(quests)
            .where(
              and(
                eq(quests.guildId, guild.id),
                lt(quests.dueDate, inicioDeHoy),
                notInArray(quests.status, ['done', 'cancelled']),
              ),
            ),
        ]),
        // Miembros: guild_members JOIN users
        db
          .select({
            id: guildMembers.id,
            userId: guildMembers.userId,
            name: user.name,
            email: user.email,
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
    const [[activeRow], [inProgressRow], [completedWeekRow], [overdueRow]] =
      statsResult

    return {
      // El invite code solo se expone al owner — para el resto de miembros
      // se omite del payload, no solo de la UI, así devtools/network no lo filtra.
      guild: { ...guild, inviteCode: isOwner ? guild.inviteCode : null },
      currentUserRole,
      stats: {
        activeCount: activeRow.count,
        inProgressCount: inProgressRow.count,
        completedThisWeekCount: completedWeekRow.count,
        overdueCount: overdueRow.count,
      },
      // Iniciales de respaldo del avatar + retiro del email, vía el helper
      // compartido con `get-quest-guilds`
      members: membersResult.map(toMemberWithInitials),
      recentActivity: recentActivityResult,
    }
  })

export type GuildDetail = Awaited<ReturnType<typeof getGuild>>
