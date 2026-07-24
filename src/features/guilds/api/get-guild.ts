// Función de servidor — obtiene el detalle completo de un guild por slug
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, count, eq, gte, lt, notInArray } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { assertGuildMembershipOrThrow } from './resolve-guild-or-throw'
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

    // Paso 2: verificar membresía y obtener el rol del usuario actual — puerta de
    // autorización compartida (misma consulta, mensaje y criterio que el resto de
    // endpoints de lectura del guild). Se aprovecha su valor de retorno para el
    // `currentUserRole` sin una segunda consulta.
    const { role: currentUserRole } = await assertGuildMembershipOrThrow(
      guild.id,
      session.user.id,
    )

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

    // Paso 3: stats y miembros en paralelo. La actividad reciente ya NO vive
    // aquí: la tarjeta del Overview la obtiene de `guild_quest_activity_log` vía
    // su propia server fn (get-guild-recent-activity), no derivada de quests.
    const [statsResult, membersResult] = await Promise.all([
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
            and(eq(quests.guildId, guild.id), eq(quests.status, 'in_progress')),
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
    }
  })

export type GuildDetail = Awaited<ReturnType<typeof getGuild>>
