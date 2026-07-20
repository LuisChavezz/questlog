// Lógica de negocio del cambio de rol de un miembro (member ↔ admin), separada
// del envoltorio RPC (update-guild-member-role.ts). El envoltorio solo resuelve
// la sesión y delega aquí; esta función recibe el `requesterId` ya autenticado y
// el `data` ya validado, así que es invocable directamente en tests con `#/db`
// mockeado — sin depender del transform del plugin de TanStack Start, que no
// está activo bajo Vitest y hace que un server fn llamado directo resuelva a
// `undefined`.
//
// El comportamiento (autorización owner-only, inmutabilidad del rol del owner y
// mensajes de error) es idéntico al que tenía inline en el handler.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers } from '#/db/schema'
import { canChangeMemberRole, isGuildOwner } from '../role-labels'
import type { UpdateGuildMemberRoleValues } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export async function updateGuildMemberRoleHandler(
  data: UpdateGuildMemberRoleValues,
  requesterId: string,
) {
  // Localizar el guild y su dueño estructural (guilds.owner_id)
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  // Autorización delegada al predicado compartido `canChangeMemberRole` (el
  // mismo que usa la UI): solo el owner puede cambiar roles, y nunca sobre el
  // propio owner. Al decidir vía el predicado en vez de reimplementar la regla
  // con `isGuildOwner` suelto, un cambio futuro en `canChangeMemberRole` (p.ej.
  // un concepto de co-owner) se aplica aquí automáticamente en vez de divergir
  // en silencio. `isGuildOwner` se reutiliza solo para elegir el mensaje
  // específico de la causa del rechazo, no para decidir la autorización.
  if (
    !canChangeMemberRole(
      { viewerId: requesterId, ownerId: guild.ownerId },
      { userId: data.userId },
    )
  ) {
    if (!isGuildOwner(guild.ownerId, requesterId)) {
      throw new Error('Forbidden: only the guild owner can change member roles')
    }

    // El rol del owner nunca se cambia por este endpoint (es estructural; para
    // cederlo existe la feature aparte de "transferir propiedad").
    throw new Error("Forbidden: the guild owner's role cannot be changed")
  }

  // Actualizar el rol del miembro objetivo. returning() confirma que la fila
  // existía; si no, el usuario no es miembro de este guild.
  const updated = await db
    .update(guildMembers)
    .set({ role: data.newRole })
    .where(
      and(
        eq(guildMembers.guildId, guild.id),
        eq(guildMembers.userId, data.userId),
      ),
    )
    .returning({ id: guildMembers.id })

  if (updated.length === 0) {
    throw new Error('Not Found: member not found in this guild')
  }

  return { userId: data.userId, role: data.newRole }
}
