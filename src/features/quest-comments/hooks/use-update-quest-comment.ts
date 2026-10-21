// Hook de mutación para editar un comentario — con actualización optimista
// sobre la caché infinita del hilo (`['quest-comments', questId]`).
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  questCommentsQueryKey,
  replaceQuestComment,
  updateQuestCommentPages,
} from '../api/quest-comments-query-options'
import type { QuestCommentsCache } from '../api/quest-comments-query-options'
import { updateQuestComment } from '../api/update-quest-comment'

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
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<QuestCommentsCache>(queryKey)

      // Mismo criterio que el servidor: un cuerpo idéntico no es una edición y
      // no muestra "edited". La marca optimista usa la hora local solo para
      // pintarse; la del servidor (`now()`) la sustituye al volver.
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

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
