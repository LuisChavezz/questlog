// Fixtures compartidas por los tests de los hooks de comentarios: una caché
// infinita sembrada bajo `['quest-comments', questId]` y un QueryClient con su
// wrapper, mismo montaje que use-update-quest.test.tsx.
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type {
  QuestCommentCacheItem,
  QuestCommentsCache,
} from '../api/quest-comments-query-options'

export const QUEST_ID = '11111111-1111-4111-8111-111111111111'

export function makeComment(
  overrides: Partial<QuestCommentCacheItem> & { id: string },
): QuestCommentCacheItem {
  return {
    body: 'A comment',
    createdAt: new Date('2026-07-20T10:00:00.000Z'),
    editedAt: null,
    author: {
      id: 'u-1',
      name: 'Ada Lovelace',
      image: null,
      avatarId: null,
      initials: 'AL',
    },
    canEdit: true,
    canDelete: true,
    ...overrides,
  }
}

// Caché con N páginas (cada una, de más nuevo a más viejo), como la deja la
// query infinita tras cargar el hilo y, opcionalmente, "Load older".
export function makeCache(
  ...pages: QuestCommentCacheItem[][]
): QuestCommentsCache {
  return {
    pages: pages.map((items, index) => ({
      items,
      hasMore: index < pages.length - 1,
      nextCursor:
        index < pages.length - 1
          ? { createdAt: '2026-07-01T00:00:00.000Z', id: `cursor-${index}` }
          : null,
    })),
    pageParams: pages.map((_, index) =>
      index === 0
        ? null
        : { createdAt: '2026-07-01T00:00:00.000Z', id: `cursor-${index - 1}` },
    ),
  }
}

export function createTestQueryClient(seed: QuestCommentsCache) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(['quest-comments', QUEST_ID], seed)

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)

  const readCache = () =>
    queryClient.getQueryData<QuestCommentsCache>(['quest-comments', QUEST_ID])

  return { queryClient, wrapper, readCache }
}

// Promesa controlable desde el test, para ordenar a mano el resultado de dos
// mutaciones solapadas.
export function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
