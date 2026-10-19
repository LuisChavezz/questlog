// Lógica de negocio del cambio de rol de un miembro (member ↔ admin), separada
// del envoltorio RPC (update-guild-member-role.ts). El envoltorio solo resuelve
// la sesión y delega aquí; esta función recibe el `requesterId` ya autenticado y
// el `data` ya validado, así que es invocable directamente en tests con `#/db`
// mockeado — sin depender del transform del plugin de TanStack Start, que no
// está activo bajo Vitest y hace que un server fn llamado directo resuelva a
// `undefined`.
//
// Autorización owner-only e inmutabilidad del rol del owner, con comprobación
// previa sin bloqueo (decide el error visible) y reverificación dentro de la
// transacción contra la fila de membresía bloqueada.
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
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

  // Membresía del objetivo (lectura sin bloqueo): decide el error visible si no
  // pertenece al guild.
  const targetMemberships = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, guild.id),
        eq(guildMembers.userId, data.userId),
      ),
    )
    .limit(1)

  if (targetMemberships.length === 0) {
    throw new Error('Not Found: member not found in this guild')
  }

  // Cambio de rol bajo transacción con relectura bloqueada. Las comprobaciones
  // de arriba usan lecturas que podrían quedar obsoletas frente a una
  // transferencia de propiedad concurrente: si esa transferencia acaba de
  // promover al objetivo a owner, escribir aquí su rol dejaría guilds.owner_id
  // con guild_members.role = 'member'; si acaba de quitarle la propiedad al
  // solicitante, un ex-owner estaría cambiando roles.
  //
  // Orden de bloqueos: SOLO la fila de membresía del objetivo, y después el
  // owner estructural releído SIN bloqueo. La autoridad del solicitante es
  // estructural (guilds.owner_id), no depende de su fila de membresía, así que
  // no hace falta bloquearla. Con un único bloqueo, tomado antes de cualquier
  // otro, esta transacción nunca espera mientras retiene algo: no puede cerrar
  // un ciclo con transfer-guild-ownership ni delete-guild (guilds →
  // guild_members), ni con los endpoints de quests (quests → guild_members).
  return db.transaction(async (tx) => {
    // Bloquear (FOR UPDATE) la membresía del objetivo. Una transferencia que lo
    // promueva a owner escribe esta misma fila, así que el bloqueo nos serializa
    // contra ella.
    const lockedTargets = await tx
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guild.id),
          eq(guildMembers.userId, data.userId),
        ),
      )
      .limit(1)
      .for('update')

    // La comprobación previa acaba de verlo como miembro: si ya no está, otra
    // transacción lo sacó del guild entre medias.
    if (lockedTargets.length === 0) {
      throw new Error(
        'Conflict: this member is no longer in the guild — please refresh and try again',
      )
    }

    // Releer el owner estructural DESPUÉS de tomar el bloqueo: así refleja una
    // transferencia ya confirmada. Lectura sin bloqueo (MVCC) a propósito, para
    // no invertir el orden guilds → guild_members de transfer-guild-ownership.
    const lockedGuilds = await tx
      .select({ ownerId: guilds.ownerId })
      .from(guilds)
      .where(eq(guilds.id, guild.id))
      .limit(1)

    // Mismo predicado que la comprobación previa, ahora contra el owner fresco:
    // el solicitante sigue siendo el owner y el objetivo no lo es. Como el check
    // de arriba acaba de pasar, si falla aquí solo puede ser por un cambio
    // concurrente (o un borrado del guild): conflicto en vez de "Forbidden".
    if (
      lockedGuilds.length === 0 ||
      !canChangeMemberRole(
        { viewerId: requesterId, ownerId: lockedGuilds[0].ownerId },
        { userId: data.userId },
      )
    ) {
      throw new Error(
        'Conflict: guild ownership changed — please refresh and try again',
      )
    }

    // Actualizar el rol del objetivo. returning() confirma que la fila seguía
    // ahí al escribir (con el bloqueo tomado no debería poder faltar).
    const updated = await tx
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
      throw new Error(
        'Conflict: this member is no longer in the guild — please refresh and try again',
      )
    }

    return { userId: data.userId, role: data.newRole }
  })
}
