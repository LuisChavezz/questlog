// Hook de mutación para publicar un comentario — con actualización optimista
// sobre la caché infinita del hilo (`['quest-comments', questId]`).
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createQuestComment } from '../api/create-quest-comment'
import type { QuestCommentAuthor } from '../api/quest-comment-item'
import {
  questCommentsQueryKey,
  replaceQuestComment,
  updateQuestCommentPages,
} from '../api/quest-comments-query-options'
import type {
  QuestCommentCacheItem,
  QuestCommentsCache,
} from '../api/quest-comments-query-options'
import { restoreCommentDraft } from '../comment-drafts'

// Id temporal del comentario optimista: nunca coincide con un uuid del servidor.
let optimisticCounter = 0
function nextOptimisticId() {
  optimisticCounter += 1
  return `optimistic-${optimisticCounter}`
}

/**
 * @param author - Autor con el que pintar el comentario optimista (el usuario
 * actual), o `null` si no se puede resolver; el servidor lo sustituye al volver.
 */
export function useCreateQuestComment(
  questId: string,
  author: QuestCommentAuthor | null,
) {
  const queryClient = useQueryClient()
  const queryKey = questCommentsQueryKey(questId)

  return useMutation({
    mutationFn: (body: string) =>
      createQuestComment({ data: { questId, body } }),

    // Insertar el comentario como el más reciente antes de la respuesta
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<QuestCommentsCache>(queryKey)
      const optimistic: QuestCommentCacheItem = {
        id: nextOptimisticId(),
        body,
        createdAt: new Date(),
        editedAt: null,
        author,
        // Sin acciones mientras está pendiente: aún no existe en el servidor.
        canEdit: false,
        canDelete: false,
        pending: true,
      }

      // La página 0 va de más nuevo a más viejo: el nuevo entra al principio.
      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        updateQuestCommentPages(cache, (items, pageIndex) =>
          pageIndex === 0 ? [optimistic, ...items] : items,
        ),
      )

      return { previous, optimisticId: optimistic.id }
    },

    // La fila del servidor sustituye a la optimista en su sitio
    onSuccess: (created, _body, context) => {
      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        replaceQuestComment(cache, context.optimisticId, created),
      )
    },

    // Revertir al snapshot y devolver el texto al borrador del composer
    onError: (_error, body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      restoreCommentDraft(questId, body)
    },

    // Solo el hilo de ESTA quest: ningún otro dato depende de sus comentarios
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
