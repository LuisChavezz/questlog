// Lógica de negocio del historial de actividad paginado de un guild (modal "View
// all"), separada del envoltorio RPC (get-guild-activity-history.ts) para poder
// testearse directamente con `#/db` mockeado.
import { db } from '#/db'
import {
  assertGuildMembershipOrThrow,
  resolveGuildBySlugOrThrow,
} from './resolve-guild-or-throw'
import {
  countGuildActivityLog,
  getGuildActivityPageBounds,
  hasMoreActivity,
  queryGuildActivityLog,
} from './guild-activity-log-query'
import type { GuildActivityLogEntry } from './guild-activity-log-query'
import type { GetGuildActivityHistoryValues } from '../schemas/guild-schemas'

// Una página del historial: las filas + lo que el botón "Load more" necesita
// para saber si seguir (`hasMore`) y el total, útil para futuros contadores.
export interface GuildActivityHistoryPage {
  items: GuildActivityLogEntry[]
  total: number
  hasMore: boolean
  page: number
}

export async function getGuildActivityHistoryHandler(
  data: GetGuildActivityHistoryValues,
  userId: string,
): Promise<GuildActivityHistoryPage> {
  const guild = await resolveGuildBySlugOrThrow(data.slug)
  await assertGuildMembershipOrThrow(guild.id, userId)

  const { limit, offset } = getGuildActivityPageBounds(data.page)

  // La página de filas y el total se leen dentro de una MISMA transacción para
  // compartir un snapshot consistente: sin ella, una inserción concurrente entre
  // ambas consultas dejaría `total` (y por tanto `hasMore`) descuadrado respecto
  // a las filas devueltas, haciendo aparecer o desaparecer el botón "Load more"
  // en el límite. Es una lectura de solo lectura —no necesita bloquear filas
  // (`FOR UPDATE`)—, basta el aislamiento por defecto de la transacción.
  const [items, total] = await db.transaction(async (tx) =>
    Promise.all([
      queryGuildActivityLog(guild.id, { limit, offset }, tx),
      countGuildActivityLog(guild.id, tx),
    ]),
  )

  return {
    items,
    total,
    hasMore: hasMoreActivity(offset, items.length, total),
    page: data.page,
  }
}
