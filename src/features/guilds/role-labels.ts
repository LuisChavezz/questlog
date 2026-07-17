// Presentación de roles de guild — etiquetas, variante de badge y orden de
// aparición. Solo capa de presentación, el enum de la base de datos
// (owner/admin/member) no cambia
import type { GuildRole } from '#/db/schema'
import type { GuildDetail } from './api/get-guild'

// Etiquetas temáticas RPG para los roles de guild
export const ROLE_LABEL = {
  owner: 'Guild Master',
  admin: 'Officer',
  member: 'Member',
} as const

// Variante visual del badge según el rol
export const ROLE_BADGE_VARIANT = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
} as const

// Rango de autoridad por rol. Se usa tanto para el orden de aparición como para comparar jerarquías en las reglas de permisos.
export const ROLE_RANK = {
  owner: 0,
  admin: 1,
  member: 2,
} as const

export type GuildMember = GuildDetail['members'][number]

// Orden estable por rol — dentro de un mismo rol conserva el orden de llegada (joinedAt asc)
export function sortMembersByRole(members: GuildMember[]): GuildMember[] {
  return [...members].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
}

// ─── Reglas de permisos de gestión de miembros ────────────────────────────────
// Fuente única de verdad compartida por la UI (para mostrar/ocultar acciones) y
// el servidor (que sigue siendo la autoridad final). Tanto estos predicados como
// los checks del servidor derivan de `isGuildOwner`, para que la noción de
// "dueño" no se implemente dos veces ni pueda divergir entre cliente y servidor.

/**
 * ¿Es `userId` el dueño estructural del guild (guilds.owner_id)?
 * Fuente única de verdad de la propiedad. Estructural a propósito: no depende de
 * guild_members.role, que ante un drift permitiría un bypass. La usan tanto los
 * predicados de abajo como get-guild.ts, settings.tsx y los endpoints de servidor.
 */
export function isGuildOwner(guildOwnerId: string, userId: string): boolean {
  return guildOwnerId === userId
}

/** Contexto del usuario que observa/ejecuta la acción sobre un miembro */
export interface GuildMemberViewer {
  viewerId: string
  viewerRole: GuildRole
  // Dueño estructural del guild (guilds.owner_id), no derivado del rol
  ownerId: string
}

type PermissionTarget = { userId: string; role: GuildRole }

/**
 * ¿Puede el observador cambiar el rol del miembro objetivo?
 * Solo el owner puede, y nunca sobre el propio owner (su rol es estructural).
 */
export function canChangeMemberRole(
  viewer: GuildMemberViewer,
  target: PermissionTarget,
): boolean {
  return (
    isGuildOwner(viewer.ownerId, viewer.viewerId) &&
    !isGuildOwner(viewer.ownerId, target.userId)
  )
}

/**
 * - Nunca a sí mismo (eso sería "leave guild", otra feature).
 * - Nunca al owner del guild.
 * - El owner puede con cualquier otro miembro.
 * - Un admin solo con rangos estrictamente inferiores al suyo. Como MENOR número
 *   = MAYOR autoridad, "inferior" significa un ROLE_RANK mayor que el del admin.
 */
export function canRemoveMember(
  viewer: GuildMemberViewer,
  target: PermissionTarget,
): boolean {
  if (target.userId === viewer.viewerId) return false
  if (isGuildOwner(viewer.ownerId, target.userId)) return false
  if (isGuildOwner(viewer.ownerId, viewer.viewerId)) return true
  if (viewer.viewerRole === 'admin') {
    return ROLE_RANK[target.role] > ROLE_RANK[viewer.viewerRole]
  }
  return false
}

/**
 * ¿Puede el observador transferir la propiedad del guild al miembro objetivo?
 * Hoy la regla es exactamente la misma que `canChangeMemberRole` (solo el owner,
 * hacia un miembro que no sea el propio owner), así que se expone como alias
 * explícito en vez de como una segunda copia idéntica: si en el futuro una regla
 * debe cambiar sin la otra, romper el alias será un paso deliberado y no una
 * divergencia accidental que se cuele sin que nadie lo note.
 */
export const canTransferOwnership = canChangeMemberRole

// ─── Reglas de permisos de quests de guild ────────────────────────────────────
// Modelo de dos ejes, fuente única de verdad para la UI (mostrar editores/ocultar
// acciones) y el servidor (autoridad final). Derivan de `isGuildOwner`/`ROLE_RANK`
// para no reimplementar la jerarquía ni divergir de las reglas de miembros.

/**
 * Datos de la quest necesarios para decidir permisos. `creatorRole` es el rol
 * del creador dentro del guild, o `null` si ya no es miembro (en cuyo caso un
 * Officer no puede demostrar que lo supera en rango).
 */
export interface GuildQuestPermissionTarget {
  // Creador de la quest (quests.owner_id)
  creatorId: string
  creatorRole: GuildRole | null
  assigneeId: string | null
  supervisorId: string | null
}

/**
 * Eje 1 — Gestión completa (título, descripción, prioridad, tags, fecha, borrado
 * y reasignación de asignado/supervisor):
 * - El creador de la quest, siempre.
 * - El Guild Master (dueño estructural), sobre cualquier quest del guild.
 * - Un Officer (admin) solo sobre quests creadas por un rango estrictamente
 *   inferior — mismo criterio de jerarquía que `canRemoveMember`.
 */
export function canManageGuildQuest(
  viewer: GuildMemberViewer,
  quest: GuildQuestPermissionTarget,
): boolean {
  if (quest.creatorId === viewer.viewerId) return true
  if (isGuildOwner(viewer.ownerId, viewer.viewerId)) return true
  if (viewer.viewerRole === 'admin' && quest.creatorRole != null) {
    return ROLE_RANK[quest.creatorRole] > ROLE_RANK[viewer.viewerRole]
  }
  return false
}

/**
 * Eje 2 — Solo estado. Además de todo el que puede gestionar (eje 1), el asignado
 * y el supervisor de la quest pueden cambiar SOLO su estado, sin importar su rol.
 */
export function canUpdateGuildQuestStatus(
  viewer: GuildMemberViewer,
  quest: GuildQuestPermissionTarget,
): boolean {
  if (canManageGuildQuest(viewer, quest)) return true
  if (quest.assigneeId != null && quest.assigneeId === viewer.viewerId) {
    return true
  }
  if (quest.supervisorId != null && quest.supervisorId === viewer.viewerId) {
    return true
  }
  return false
}

/**
 * ¿Puede el observador crear quests dentro del guild? Solo el Guild Master
 * (dueño estructural) y los Officers (admin); un Member no crea quests de guild.
 */
export function canCreateGuildQuest(viewer: GuildMemberViewer): boolean {
  return (
    isGuildOwner(viewer.ownerId, viewer.viewerId) ||
    viewer.viewerRole === 'admin'
  )
}
