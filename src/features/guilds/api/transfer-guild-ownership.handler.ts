// Lógica de negocio de la transferencia de propiedad de un guild, separada del
// envoltorio RPC (transfer-guild-ownership.ts). El envoltorio solo resuelve la
// sesión y delega aquí; esta función recibe el `requesterId` ya autenticado y el
// `data` ya validado, así que es invocable directamente en tests con `#/db`
// mockeado — sin depender del transform del plugin de TanStack Start, que no
// está activo bajo Vitest y hace que un server fn llamado directo resuelva a
// `undefined`.
//
// Acción de alta consecuencia: el owner actual pasa a `member` y el objetivo a
// `owner`. Debe preservar el invariante guilds.owner_id ⇔ guild_members.role =
// 'owner', por lo que las tres escrituras van en una única transacción atómica:
// o se aplican todas o ninguna, para no dejar el guild sin owner o con dos.
//
// La propiedad se REVERIFICA dentro de la transacción contra una lectura con
// bloqueo de fila (`FOR UPDATE`), no contra el snapshot leído antes de abrirla.
// Así dos transferencias concurrentes se serializan sobre la misma fila de
// `guilds`: la segunda relee el owner ya actualizado y aborta con un conflicto,
// en vez de aplicar escrituras a ciegas sobre un estado obsoleto y dejar dos
// filas con role='owner' (o guilds.owner_id apuntando a un ex-miembro).
import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import { canTransferOwnership, isGuildOwner } from '../role-labels'
import type { TransferGuildOwnershipValues } from '../schemas/guild-schemas'
import { resolveGuildBySlugOrThrow } from './resolve-guild-or-throw'

export async function transferGuildOwnershipHandler(
  data: TransferGuildOwnershipValues,
  requesterId: string,
) {
  // Localizar el guild y su dueño estructural (guilds.owner_id)
  const guild = await resolveGuildBySlugOrThrow(data.slug)

  // Autorización delegada al predicado compartido `canTransferOwnership` (el
  // mismo que usa la UI, alias de `canChangeMemberRole`): solo el owner actual
  // puede transferir, y nunca hacia sí mismo. Al decidir vía el predicado en
  // vez de reimplementar la regla con `isGuildOwner` suelto, un cambio futuro
  // ahí se aplica aquí automáticamente en vez de divergir en silencio.
  // `isGuildOwner` se reutiliza solo para elegir el mensaje específico de la
  // causa del rechazo, no para decidir la autorización.
  if (
    !canTransferOwnership(
      { viewerId: requesterId, ownerId: guild.ownerId },
      { userId: data.newOwnerUserId },
    )
  ) {
    if (!isGuildOwner(guild.ownerId, requesterId)) {
      throw new Error('Forbidden: only the current owner can transfer ownership')
    }

    // Transferir a uno mismo no tiene sentido — error claro en vez de un no-op
    // que aparentaría éxito. Solo puede llegar aquí si `data.newOwnerUserId`
    // ya es el owner, y dado que `requesterId` lo es (rama anterior), eso
    // significa que el objetivo es el propio solicitante.
    throw new Error('Bad Request: you are already the owner of this guild')
  }

  // El nuevo owner debe ser ya miembro del guild — por esta acción no se invita
  // a nadie nuevo.
  const targetMemberships = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, guild.id),
        eq(guildMembers.userId, data.newOwnerUserId),
      ),
    )
    .limit(1)

  if (targetMemberships.length === 0) {
    throw new Error(
      'Bad Request: the new owner must already be a member of this guild',
    )
  }

  // Transacción atómica: reverificación de propiedad con bloqueo de fila +
  // las tres escrituras (propietario estructural + los dos roles) en un bloque.
  const result = await db.transaction(async (tx) => {
    // Relectura del guild con bloqueo exclusivo de la fila (`FOR UPDATE`).
    // Serializa transferencias concurrentes sobre este mismo guild: mientras
    // esta transacción no confirme, cualquier otra que intente leer la fila con
    // bloqueo queda a la espera.
    const lockedGuilds = await tx
      .select({ id: guilds.id, ownerId: guilds.ownerId })
      .from(guilds)
      .where(eq(guilds.slug, data.slug))
      .limit(1)
      .for('update')

    // La fila existía en la lectura previa; si ya no está, hubo un cambio
    // concurrente (p. ej. el guild se borró). Se trata como conflicto.
    if (lockedGuilds.length === 0) {
      throw new Error(
        'Conflict: the guild changed while transferring — please refresh and try again',
      )
    }

    const lockedGuild = lockedGuilds[0]

    // Verificación AUTORITATIVA contra la lectura bloqueada. Justo antes de la
    // transacción ya confirmamos que el solicitante era el owner, así que si
    // aquí ya no lo es, solo puede deberse a otra transferencia que ganó la
    // carrera: abortamos en vez de escribir sobre un estado obsoleto. Reverifica
    // solo el lado del solicitante (no pasa por `canTransferOwnership`): el
    // pre-check de arriba ya validó el objetivo contra el snapshot, y añadir
    // aquí esa segunda mitad sería una validación nueva que este re-check nunca
    // tuvo, no una migración de la lógica existente.
    if (!isGuildOwner(lockedGuild.ownerId, requesterId)) {
      throw new Error(
        'Conflict: ownership has already changed — please refresh and try again',
      )
    }

    // 1. guilds.owner_id → nuevo owner
    await tx
      .update(guilds)
      .set({ ownerId: data.newOwnerUserId })
      .where(eq(guilds.id, lockedGuild.id))

    // 2. owner actual → member. returning() confirma que su fila de membresía
    // existía; 0 filas delataría una inconsistencia (owner sin membresía) y se
    // aborta para no romper el invariante a medias.
    const demoted = await tx
      .update(guildMembers)
      .set({ role: 'member' })
      .where(
        and(
          eq(guildMembers.guildId, lockedGuild.id),
          eq(guildMembers.userId, requesterId),
        ),
      )
      .returning({ id: guildMembers.id })

    if (demoted.length === 0) {
      throw new Error(
        'Conflict: your membership changed while transferring — please refresh and try again',
      )
    }

    // 3. nuevo owner → owner. returning() confirma que el objetivo seguía
    // siendo miembro al escribir; si su fila fue borrada de forma concurrente
    // (p. ej. una expulsión simultánea), 0 filas y se aborta para no dejar
    // guilds.owner_id apuntando a un usuario sin membresía.
    const promoted = await tx
      .update(guildMembers)
      .set({ role: 'owner' })
      .where(
        and(
          eq(guildMembers.guildId, lockedGuild.id),
          eq(guildMembers.userId, data.newOwnerUserId),
        ),
      )
      .returning({ id: guildMembers.id })

    if (promoted.length === 0) {
      throw new Error(
        'Conflict: the new owner is no longer a member of this guild — please refresh and try again',
      )
    }

    return {
      guildId: lockedGuild.id,
      previousOwnerUserId: requesterId,
      newOwnerUserId: data.newOwnerUserId,
    }
  })

  return result
}
