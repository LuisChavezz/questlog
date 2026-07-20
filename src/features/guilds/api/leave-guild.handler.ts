// Lógica de negocio de abandonar un guild, separada del envoltorio RPC
// (leave-guild.ts). El envoltorio solo resuelve la sesión y delega aquí; esta
// función recibe el `userId` ya autenticado y el `data` ya validado, así que es
// invocable directamente en tests con `#/db` mockeado — sin depender del
// transform del plugin de TanStack Start, que no está activo bajo Vitest y hace
// que un server fn llamado directo resuelva a `undefined`.
//
// El comportamiento (el owner debe transferir antes de salir y los mensajes de
// error) es idéntico al que tenía inline en el handler.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers } from '#/db/schema'
import { isGuildOwner } from '../role-labels'
import type { LeaveGuildValues } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export async function leaveGuildHandler(
  data: LeaveGuildValues,
  userId: string,
) {
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
      and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, userId)),
    )
    .returning({ id: guildMembers.id })

  if (removed.length === 0) {
    throw new Error('Forbidden: you are not a member of this guild')
  }

  return { slug: data.slug }
}
