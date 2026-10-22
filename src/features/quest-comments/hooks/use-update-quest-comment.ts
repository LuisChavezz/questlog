// Hook de mutación para editar un comentario — con actualización optimista
// sobre la caché infinita del hilo (`['quest-comments', questId]`). El error,
// si lo hay, se publica en el store de la quest desde el `onError` de nivel de
// hook, que corre para cada edición aunque se solapen varias.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  findQuestComment,
  questCommentsQueryKey,
  replaceQuestComment,
  updateQuestCommentPages,
} from '../api/quest-comments-query-options'
import type { QuestCommentsCache } from '../api/quest-comments-query-options'
import { updateQuestComment } from '../api/update-quest-comment'
import { setCommentError } from '../comment-drafts'
import { getQuestCommentErrorMessage } from '../comment-error-message'

interface UpdateQuestCommentVariables {
  commentId: string
  body: string
}

export function useUpdateQuestComment(questId: string) {
  const queryClient = useQueryClient()
  const queryKey = questCommentsQueryKey(questId)

  return useMutation({
    mutationFn: ({ commentId, body }: UpdateQuestCommentVariables) =>
      updateQuestComment({ data: { questId, commentId, body } }),

    onMutate: async ({ commentId, body }) => {
      setCommentError(questId, null)
      await queryClient.cancelQueries({ queryKey })

      // Solo la versión previa de ESTE comentario, para un rollback dirigido.
      const previous = findQuestComment(
        queryClient.getQueryData<QuestCommentsCache>(queryKey),
        commentId,
      )?.item

      // Mismo criterio que el servidor: un cuerpo idéntico no es una edición y
      // no muestra "edited". La marca optimista usa la hora local solo para
      // pintarse; la del servidor la sustituye al volver.
      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        updateQuestCommentPages(cache, (items) =>
          items.map((item) =>
            item.id === commentId && item.body !== body
              ? { ...item, body, editedAt: new Date() }
              : item,
          ),
        ),
      )

      return { previous }
    },

    onSuccess: (updated) => {
      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        replaceQuestComment(cache, updated.id, updated),
      )
    },

    // Rollback dirigido: solo este comentario vuelve a su versión previa.
    onError: (error, { commentId }, context) => {
      const previous = context?.previous
      if (previous) {
        queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
          replaceQuestComment(cache, commentId, previous),
        )
      }
      setCommentError(questId, getQuestCommentErrorMessage(error, 'edit'))
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
