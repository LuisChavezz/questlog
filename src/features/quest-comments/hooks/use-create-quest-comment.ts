// Hook de mutación para publicar un comentario — con actualización optimista
// sobre la caché infinita del hilo (`['quest-comments', questId]`).
//
// Todo el feedback va en los callbacks de nivel de hook, que corren para CADA
// publicación (los de `mutate(..., { onError })` solo corren para la última):
// el error se publica en el store de la quest y el texto vuelve al borrador.
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
import { keepFailedComment, setCommentError } from '../comment-drafts'

// Id temporal del comentario optimista: nunca coincide con un uuid del servidor.
let optimisticCounter = 0
function nextOptimisticId() {
  optimisticCounter += 1
  return `optimistic-${optimisticCounter}`
}

/**
 * @param author - Autor con el que pintar el comentario optimista (el usuario
 * de la sesión), o `null` si aún no se conoce; el servidor lo sustituye al volver.
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
      // Una acción nueva descarta el error anterior de este hilo.
      setCommentError(questId, null)
      await queryClient.cancelQueries({ queryKey })

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

      return { optimisticId: optimistic.id }
    },

    // La fila del servidor sustituye a la optimista en su sitio
    onSuccess: (created, _body, context) => {
      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        replaceQuestComment(cache, context.optimisticId, created),
      )
    },

    // Rollback DIRIGIDO: se retira solo este comentario optimista. Restaurar un
    // snapshot de toda la caché borraría también lo que otra publicación o
    // borrado solapado haya parcheado después. El texto nunca se pierde: vuelve
    // al borrador si está vacío o queda en los no enviados de la quest (ver
    // `keepFailedComment`), y el error se publica para la quest.
    onError: (error, body, context) => {
      if (context) {
        queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
          updateQuestCommentPages(cache, (items) =>
            items.filter((item) => item.id !== context.optimisticId),
          ),
        )
      }
      keepFailedComment(questId, body)
      setCommentError(questId, error.message)
    },

    // Solo el hilo de ESTA quest: ningún otro dato depende de sus comentarios
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
