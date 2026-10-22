// Opciones de query del hilo de comentarios de una quest, y helpers para
// parchear su caché (páginas de una query infinita) desde las mutaciones.
//
// Clave `['quest-comments', questId]`, HERMANA de `['quests']` y de
// `['guild', slug]` a propósito: el hilo no cambia cuando cambia la quest o el
// guild, así que no debe caer en la invalidación por prefijo de `['guild', slug]`
// ni vivir bajo `['quests']`, que los hooks de quests asumen un `Quest[]`.
import { infiniteQueryOptions } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'

import type { QuestCommentCursor } from '../schemas/quest-comment-schemas'
import { getQuestComments } from './get-quest-comments'
import type { QuestCommentItem, QuestCommentsPage } from './quest-comment-item'

export function questCommentsQueryKey(questId: string) {
  return ['quest-comments', questId] as const
}

// Un comentario tal como vive en la caché: el del servidor, o uno optimista
// recién publicado que aún espera respuesta (`pending`).
export interface QuestCommentCacheItem extends QuestCommentItem {
  pending?: boolean
}

export interface QuestCommentsCachePage extends Omit<
  QuestCommentsPage,
  'items'
> {
  items: QuestCommentCacheItem[]
}

export type QuestCommentsCache = InfiniteData<
  QuestCommentsCachePage,
  QuestCommentCursor | null
>

// Página 0 = los 20 más recientes (de más nuevo a más viejo); cada página
// siguiente, los 20 anteriores a su cursor. "Load older" pide la siguiente.
export const questCommentsInfiniteQueryOptions = (questId: string) =>
  infiniteQueryOptions({
    queryKey: questCommentsQueryKey(questId),
    queryFn: ({ pageParam }): Promise<QuestCommentsCachePage> =>
      getQuestComments({
        data: { questId, cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as QuestCommentCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 20, // 20 segundos
  })

/**
 * Aplica `update` a los comentarios de todas las páginas cargadas, conservando
 * la estructura de la query infinita. Sin caché (hilo nunca cargado) no hay
 * nada que parchear.
 */
export function updateQuestCommentPages(
  cache: QuestCommentsCache | undefined,
  update: (
    items: QuestCommentCacheItem[],
    pageIndex: number,
  ) => QuestCommentCacheItem[],
): QuestCommentsCache | undefined {
  if (!cache) return cache

  return {
    ...cache,
    pages: cache.pages.map((page, pageIndex) => ({
      ...page,
      items: update(page.items, pageIndex),
    })),
  }
}

/** Sustituye un comentario (por id) en cualquier página donde esté. */
export function replaceQuestComment(
  cache: QuestCommentsCache | undefined,
  id: string,
  next: QuestCommentCacheItem,
) {
  return updateQuestCommentPages(cache, (items) =>
    items.map((item) => (item.id === id ? next : item)),
  )
}

/**
 * Localiza un comentario en la caché: el ítem y su posición (página e índice),
 * para que un rollback lo devuelva exactamente a su sitio.
 */
export function findQuestComment(
  cache: QuestCommentsCache | undefined,
  id: string,
) {
  if (!cache) return null

  for (const [pageIndex, page] of cache.pages.entries()) {
    const index = page.items.findIndex((item) => item.id === id)
    const item = page.items.at(index)
    if (index !== -1 && item) return { item, pageIndex, index }
  }

  return null
}

/** Hilo de más antiguo a más reciente: el orden en que se pinta. */
export function flattenQuestCommentPages(
  cache: Pick<QuestCommentsCache, 'pages'>,
) {
  return cache.pages.flatMap((page) => page.items).reverse()
}
