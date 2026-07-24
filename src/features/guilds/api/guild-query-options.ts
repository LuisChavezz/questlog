// Opciones de query para TanStack Query — detalle y quests de un guild
// Compartidas por el loader de la ruta (SSR) y los componentes (cliente)
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { getGuild } from './get-guild'
import { getGuildQuests } from './get-guild-quests'
import { getGuildRecentActivity } from './get-guild-recent-activity'
import { getGuildActivityHistory } from './get-guild-activity-history'

export const guildQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['guild', slug],
    queryFn: () => getGuild({ data: { slug } }),
    staleTime: 1000 * 20, // 20 segundos
  })

export const guildQuestsQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['guild', slug, 'quests'],
    queryFn: () => getGuildQuests({ data: { slug } }),
    staleTime: 1000 * 20, // 20 segundos
  })

// Actividad reciente (tarjeta del Overview, top 5). La clave cuelga de
// `['guild', slug]` a propósito: toda mutación de quest ya invalida ese prefijo
// (ver quests-table), así que la tarjeta se refresca tras crear/editar sin
// invalidación extra.
export const guildRecentActivityQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['guild', slug, 'activity', 'recent'],
    queryFn: () => getGuildRecentActivity({ data: { slug } }),
    staleTime: 1000 * 20, // 20 segundos
  })

// Historial paginado (modal "View all"). Página 0-based; `getNextPageParam`
// devuelve la siguiente solo mientras `hasMore`, de modo que "Load more" se
// detiene solo al llegar al final. Misma raíz `['guild', slug]` que el resto.
export const guildActivityHistoryInfiniteQueryOptions = (slug: string) =>
  infiniteQueryOptions({
    queryKey: ['guild', slug, 'activity', 'history'],
    queryFn: ({ pageParam }) =>
      getGuildActivityHistory({ data: { slug, page: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 1000 * 20, // 20 segundos
  })
