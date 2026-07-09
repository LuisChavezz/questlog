// Presentación de roles de guild — etiquetas, variante de badge y orden de
// aparición. Solo capa de presentación, el enum de la base de datos
// (owner/admin/member) no cambia
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

// Orden de aparición: dueño primero, luego admins, luego miembros
const ROLE_RANK = {
  owner: 0,
  admin: 1,
  member: 2,
} as const

export type GuildMember = GuildDetail['members'][number]

// Orden estable por rol — dentro de un mismo rol conserva el orden de llegada (joinedAt asc)
export function sortMembersByRole(members: GuildMember[]): GuildMember[] {
  return [...members].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
}
