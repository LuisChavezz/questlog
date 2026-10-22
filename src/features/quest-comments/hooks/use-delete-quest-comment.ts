// Hook de mutación para borrar un comentario — lo retira de la caché infinita
// del hilo (`['quest-comments', questId]`) antes de la respuesta del servidor.
// El error, si lo hay, se publica en el store de la quest desde el `onError` de
// nivel de hook, que corre para cada borrado aunque se solapen varios.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteQuestComment } from '../api/delete-quest-comment'
import {
  findQuestComment,
  questCommentsQueryKey,
  updateQuestCommentPages,
} from '../api/quest-comments-query-options'
import type { QuestCommentsCache } from '../api/quest-comments-query-options'
import { setCommentError } from '../comment-drafts'

export function useDeleteQuestComment(questId: string) {
  const queryClient = useQueryClient()
  const queryKey = questCommentsQueryKey(questId)

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string }) =>
      deleteQuestComment({ data: { questId, commentId } }),

    onMutate: async ({ commentId }) => {
      setCommentError(questId, null)
      await queryClient.cancelQueries({ queryKey })

      // Dónde estaba el comentario, para devolverlo a ESE sitio si falla.
      const removed = findQuestComment(
        queryClient.getQueryData<QuestCommentsCache>(queryKey),
        commentId,
      )

      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        updateQuestCommentPages(cache, (items) =>
          items.filter((item) => item.id !== commentId),
        ),
      )

      return { removed }
    },

    // Rollback dirigido: solo vuelve este comentario, en su posición. Restaurar
    // un snapshot de toda la caché resucitaría también lo que un borrado
    // solapado y exitoso ya retiró.
    onError: (error, _variables, context) => {
      const removed = context?.removed
      if (removed) {
        queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
          updateQuestCommentPages(cache, (items, pageIndex) => {
            if (pageIndex !== removed.pageIndex) return items
            if (items.some((item) => item.id === removed.item.id)) return items
            const next = [...items]
            next.splice(removed.index, 0, removed.item)
            return next
          }),
        )
      }
      setCommentError(questId, error.message)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
