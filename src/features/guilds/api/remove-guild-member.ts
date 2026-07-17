// Función de servidor — expulsa a un miembro del guild.
// El owner puede expulsar a cualquiera (salvo a sí mismo); un admin
// solo a miembros de rango estrictamente inferior.
// servidor: la UI solo oculta acciones no permitidas.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds, quests } from '#/db/schema'
import { auth } from '#/lib/auth'
import { canRemoveMember, isGuildOwner } from '../role-labels'
import type { GuildMemberViewer } from '../role-labels'
import { removeGuildMemberSchema } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export const removeGuildMember = createServerFn({ method: 'POST' })
  .inputValidator(removeGuildMemberSchema)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in')
    }

    const requesterId = session.user.id

    // Localizar el guild y su dueño estructural (guilds.owner_id). Se resuelve
    // ANTES de cualquier lógica de permisos —igual que en los endpoints
    // hermanos (leave/transfer/update-role)— para que un slug inexistente
    // devuelva "Not Found" y no un "Forbidden" que despistaría sobre la causa.
    const guild = await resolveGuildBySlugOrThrow(data.slug)

    // Nadie se expulsa a sí mismo por esta acción (eso sería "leave guild",
    // una feature distinta y fuera de alcance aquí).
    if (data.userId === requesterId) {
      throw new Error('Forbidden: you cannot remove yourself from the guild')
    }

    // El owner nunca puede ser expulsado por esta acción.
    if (isGuildOwner(guild.ownerId, data.userId)) {
      throw new Error('Forbidden: the guild owner cannot be removed')
    }

    // Rol del solicitante y del objetivo dentro de este guild (una sola query).
    const memberships = await db
      .select({ userId: guildMembers.userId, role: guildMembers.role })
      .from(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          inArray(guildMembers.userId, [requesterId, data.userId]),
        ),
      )

    const requester = memberships.find((m) => m.userId === requesterId)
    const target = memberships.find((m) => m.userId === data.userId)

    if (!requester) {
      throw new Error('Forbidden: you are not a member of this guild')
    }
    if (!target) {
      throw new Error('Not Found: member not found in this guild')
    }

    // Autorización delegada al predicado compartido `canRemoveMember` (el mismo
    // que usa la UI): el owner puede con cualquier otro miembro, un admin solo
    // con rangos estrictamente inferiores. Las exclusiones de "sí mismo" y "el
    // owner" ya se lanzaron arriba con sus mensajes propios, así que aquí el
    // predicado decide solo la parte de jerarquía.
    const viewer: GuildMemberViewer = {
      viewerId: requesterId,
      viewerRole: requester.role,
      ownerId: guild.ownerId,
    }

    if (!canRemoveMember(viewer, { userId: data.userId, role: target.role })) {
      throw new Error(
        'Forbidden: you do not have permission to remove this member',
      )
    }

    // Expulsión bajo transacción con relectura bloqueada. Las comprobaciones de
    // arriba usan lecturas que podrían quedar obsoletas frente a una
    // transferencia de propiedad concurrente: si esa transferencia acaba de
    // promover al objetivo a owner, borrar su fila dejaría guilds.owner_id
    // apuntando a un usuario sin membresía. Reverificamos contra filas bloqueadas.
    const result = await db.transaction(async (tx) => {
      // Bloquear (FOR UPDATE) las filas de membresía de solicitante y objetivo.
      // Una transferencia que promueva al objetivo debe escribir su misma fila,
      // así que tomar el lock se serializa contra ella.
      const lockedMemberships = await tx
        .select({ userId: guildMembers.userId, role: guildMembers.role })
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guild.id),
            inArray(guildMembers.userId, [requesterId, data.userId]),
          ),
        )
        .for('update')

      const lockedRequester = lockedMemberships.find(
        (m) => m.userId === requesterId,
      )
      const lockedTarget = lockedMemberships.find(
        (m) => m.userId === data.userId,
      )

      if (!lockedRequester) {
        throw new Error('Forbidden: you are not a member of this guild')
      }
      if (!lockedTarget) {
        throw new Error('Not Found: member not found in this guild')
      }

      // Releer el owner estructural DESPUÉS de tomar los locks: así refleja una
      // transferencia ya confirmada. Lectura sin bloqueo (MVCC) a propósito, para
      // no invertir el orden de locks respecto a transfer-guild-ownership
      // (guilds → guild_members) y evitar deadlocks: como el objetivo comparte su
      // fila de membresía con esa transferencia, el lock ya nos serializa.
      const lockedGuilds = await tx
        .select({ ownerId: guilds.ownerId })
        .from(guilds)
        .where(eq(guilds.id, guild.id))
        .limit(1)

      // El guild se localizó arriba y no existe borrado de guilds, así que la
      // fila está garantizada: se indexa directo, igual que en el resto del código.
      const currentOwnerId = lockedGuilds[0].ownerId

      // Si el objetivo es ahora el owner (una transferencia ganó la carrera), no
      // se puede expulsar: abortar en vez de dejar el guild con un owner sin fila.
      if (isGuildOwner(currentOwnerId, data.userId)) {
        throw new Error(
          'Conflict: this member is now the guild owner — please refresh and try again',
        )
      }

      // Reverificar la autorización contra el estado bloqueado (roles frescos) con
      // el mismo predicado compartido. Solo puede fallar aquí si algo cambió tras
      // las comprobaciones de arriba, de ahí el conflicto en vez del "Forbidden".
      const lockedViewer: GuildMemberViewer = {
        viewerId: requesterId,
        viewerRole: lockedRequester.role,
        ownerId: currentOwnerId,
      }

      if (
        !canRemoveMember(lockedViewer, {
          userId: data.userId,
          role: lockedTarget.role,
        })
      ) {
        throw new Error(
          'Conflict: member permissions changed — please refresh and try again',
        )
      }

      // Borrar; returning() confirma que la fila seguía existiendo al escribir.
      const deleted = await tx
        .delete(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guild.id),
            eq(guildMembers.userId, data.userId),
          ),
        )
        .returning({ id: guildMembers.id })

      if (deleted.length === 0) {
        throw new Error('Not Found: member not found in this guild')
      }

      // Limpiar asignado/supervisor: el expulsado deja de ser miembro, así que
      // ninguna quest del guild puede seguir apuntándolo en esos campos. Misma
      // transacción que el borrado de la membresía — no debe existir un instante
      // en que la membresía ya no exista pero la referencia siga viva. Solo
      // afecta a quests DE ESTE guild (por eq(quests.guildId, ...)); si el usuario
      // es asignado/supervisor en otro guild, esa referencia no se toca. El
      // creador (ownerId) tampoco se toca: el rol de guild no retroactivamente
      // le quita la autoría de sus quests.
      await tx
        .update(quests)
        .set({ assigneeId: null })
        .where(
          and(eq(quests.guildId, guild.id), eq(quests.assigneeId, data.userId)),
        )

      await tx
        .update(quests)
        .set({ supervisorId: null })
        .where(
          and(
            eq(quests.guildId, guild.id),
            eq(quests.supervisorId, data.userId),
          ),
        )

      return { userId: data.userId }
    })

    return result
  })
