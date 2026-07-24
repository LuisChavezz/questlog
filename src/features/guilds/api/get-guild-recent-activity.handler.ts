// Lógica de negocio de la actividad reciente de un guild (tarjeta "Recent
// Activity", top 5), separada del envoltorio RPC (get-guild-recent-activity.ts)
// para poder testearse directamente con `#/db` mockeado — el envoltorio solo
// resuelve la sesión y delega aquí con el `userId` ya autenticado.
import {
  assertGuildMembershipOrThrow,
  resolveGuildBySlugOrThrow,
} from './resolve-guild-or-throw'
import { queryGuildActivityLog } from './guild-activity-log-query'
import type { GuildActivityLogEntry } from './guild-activity-log-query'

// Cuántas entradas muestra la tarjeta de resumen del Overview.
const RECENT_ACTIVITY_LIMIT = 5

export async function getGuildRecentActivityHandler(
  slug: string,
  userId: string,
): Promise<GuildActivityLogEntry[]> {
  // Resolver el guild antes que la membresía: un slug inexistente devuelve
  // "Not Found", no un "Forbidden" que despistaría sobre la causa (mismo criterio
  // que el resto de endpoints del guild).
  const guild = await resolveGuildBySlugOrThrow(slug)
  await assertGuildMembershipOrThrow(guild.id, userId)

  return queryGuildActivityLog(guild.id, { limit: RECENT_ACTIVITY_LIMIT })
}
