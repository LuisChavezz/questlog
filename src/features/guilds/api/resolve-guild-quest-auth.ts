// Helper de servidor — resuelve el contexto de autorización de una quest de
// guild: el dueño estructural del guild y el rol de cada miembro. Centraliza el
// fetch que, si no, se repetiría en create-quest / update-quest / delete-quest(s).
// La autorización en sí la deciden los predicados de role-labels con estos datos.
//
// Dos variantes, una por momento: `resolveGuildQuestAuth` (sin bloqueo) para la
// comprobación previa, que decide el error que ve el usuario; y
// `resolveLockedGuildQuestAuth` (con `FOR UPDATE`) para reverificar dentro de la
// transacción que escribe, contra el estado real y no contra aquel snapshot.
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, guilds } from '#/db/schema'
import type { GuildRole } from '#/db/schema'
import type { GuildMemberViewer } from '../role-labels'

export interface GuildQuestAuthContext {
  // Observador listo para pasar a los predicados canManage/canUpdateStatus/canCreate
  viewer: GuildMemberViewer
  // Rol de cada miembro del guild, por userId — para resolver el rol del creador
  // de una quest y validar la membresía de asignado/supervisor.
  roleByUserId: Map<string, GuildRole>
}

// La transacción tal y como la recibe el callback de `db.transaction`. Se deriva
// del propio `db` para no acoplar el helper al driver concreto.
export type GuildQuestAuthTx = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]

// Ids únicos y no nulos a buscar en `guild_members` — el observador siempre
// entra, más los que aporte cada llamador (creador de la quest, asignado,
// supervisor). Compartido por las dos variantes para no repetir el filtrado.
function resolveTargetUserIds(
  viewerId: string,
  relatedUserIds: ReadonlyArray<string | null | undefined>,
): string[] {
  return [
    ...new Set([
      viewerId,
      ...relatedUserIds.filter((id): id is string => id != null),
    ]),
  ]
}

// A partir de las filas de membresía ya leídas, arma el mapa de roles y
// confirma que el observador sigue siendo miembro. Lanza "Forbidden" si no —
// mismo mensaje en ambas variantes, aquí en un solo lugar.
function resolveViewerRole(
  viewerId: string,
  memberRows: { userId: string; role: GuildRole }[],
): { viewerRole: GuildRole; roleByUserId: Map<string, GuildRole> } {
  const roleByUserId = new Map(memberRows.map((m) => [m.userId, m.role]))

  const viewerRole = roleByUserId.get(viewerId)
  if (viewerRole === undefined) {
    throw new Error('Forbidden: you are not a member of this guild')
  }

  return { viewerRole, roleByUserId }
}

/**
 * Localiza el guild y confirma que el observador es miembro. Lanza "Not Found"
 * si el guild no existe y "Forbidden" si el observador no pertenece a él —
 * mismos mensajes que ya usaban los endpoints de quests.
 *
 * Solo trae de `guild_members` las filas que el llamador vaya a necesitar: el
 * observador y los ids de `relatedUserIds` (creador de la quest, asignado,
 * supervisor) — nunca el guild entero. Cada llamador debe listar en
 * `relatedUserIds` TODO id cuyo rol/membresía vaya a consultar después en
 * `roleByUserId`; uno que falte ahí se verá como "no miembro".
 */
export async function resolveGuildQuestAuth(
  guildId: string,
  viewerId: string,
  relatedUserIds: ReadonlyArray<string | null | undefined> = [],
): Promise<GuildQuestAuthContext> {
  // Dueño estructural (guilds.owner_id), no derivado del rol, para no permitir
  // un bypass por drift — mismo criterio que el resto de la feature de guilds.
  const guildRows = await db
    .select({ ownerId: guilds.ownerId })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1)

  if (guildRows.length === 0) {
    throw new Error('Not Found: guild not found')
  }

  const userIds = resolveTargetUserIds(viewerId, relatedUserIds)
  const memberRows = await db
    .select({ userId: guildMembers.userId, role: guildMembers.role })
    .from(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, guildId),
        inArray(guildMembers.userId, userIds),
      ),
    )

  const { viewerRole, roleByUserId } = resolveViewerRole(viewerId, memberRows)

  return {
    viewer: { viewerId, viewerRole, ownerId: guildRows[0].ownerId },
    roleByUserId,
  }
}

/**
 * Variante transaccional de `resolveGuildQuestAuth`, para el momento de escribir:
 * relee el contexto con las filas de `guild_members` BLOQUEADAS (`FOR UPDATE`),
 * de modo que los permisos se reverifiquen contra el estado real y no contra un
 * snapshot que una expulsión, un cambio de rol o una transferencia de propiedad
 * concurrente ya hayan invalidado. Mientras esta transacción no confirme, esas
 * acciones quedan a la espera en vez de colarse entre el check y el write.
 *
 * A diferencia de la variante sin bloqueo, NO lee el guild entero: bloquear cada
 * fila de membresía serializaría entre sí toda escritura de quests del guild y la
 * gestión de miembros. Solo se bloquea aquello de lo que depende la decisión —
 * el observador y los usuarios de `relatedUserIds` (creador de la quest, nuevo
 * asignado, nuevo supervisor).
 *
 * OJO: por eso `roleByUserId` contiene SOLO a esos usuarios y no al guild entero.
 * Quien consulte aquí el rol o la membresía de alguien debe haberlo pasado en
 * `relatedUserIds`; de lo contrario lo verá como "no miembro".
 */
export async function resolveLockedGuildQuestAuth(
  tx: GuildQuestAuthTx,
  guildId: string,
  viewerId: string,
  relatedUserIds: ReadonlyArray<string | null | undefined> = [],
): Promise<GuildQuestAuthContext> {
  const userIds = resolveTargetUserIds(viewerId, relatedUserIds)

  // Bloqueo exclusivo de las membresías implicadas. Toda acción de gestión de
  // miembros sobre estos usuarios (expulsión, cambio de rol, transferencia)
  // escribe estas mismas filas, así que tomar el bloqueo nos serializa con ella.
  const memberRows = await tx
    .select({ userId: guildMembers.userId, role: guildMembers.role })
    .from(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, guildId),
        inArray(guildMembers.userId, userIds),
      ),
    )
    .for('update')

  // Mismo mensaje que la variante sin bloqueo: aquí solo puede fallar si la
  // membresía del observador desapareció tras la comprobación previa.
  const { viewerRole, roleByUserId } = resolveViewerRole(viewerId, memberRows)

  // El dueño estructural se relee DESPUÉS de tomar los bloqueos, para que refleje
  // una transferencia de propiedad ya confirmada. Lectura SIN bloqueo (MVCC) a
  // propósito, para no invertir el orden de bloqueos respecto a
  // transfer-guild-ownership (guilds → guild_members) y evitar deadlocks: esa
  // transferencia escribe las membresías del owner saliente y del entrante, así
  // que el bloqueo de arriba ya nos serializa contra ella. Mismo criterio que
  // remove-guild-member.
  //
  // El guild se resolvió en la comprobación previa y no existe borrado de guilds,
  // así que la fila está garantizada: se indexa directo, igual que en el resto
  // del código.
  const guildRows = await tx
    .select({ ownerId: guilds.ownerId })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1)

  return {
    viewer: { viewerId, viewerRole, ownerId: guildRows[0].ownerId },
    roleByUserId,
  }
}
