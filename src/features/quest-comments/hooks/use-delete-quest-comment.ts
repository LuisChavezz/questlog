// Hook de mutación para borrar un comentario — lo retira de la caché infinita
// del hilo (`['quest-comments', questId]`) antes de la respuesta del servidor.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteQuestComment } from '../api/delete-quest-comment'
import {
  questCommentsQueryKey,
  updateQuestCommentPages,
} from '../api/quest-comments-query-options'
import type { QuestCommentsCache } from '../api/quest-comments-query-options'

export function useDeleteQuestComment(questId: string) {
  const queryClient = useQueryClient()
  const queryKey = questCommentsQueryKey(questId)

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string }) =>
      deleteQuestComment({ data: { questId, commentId } }),

    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<QuestCommentsCache>(queryKey)

      queryClient.setQueryData<QuestCommentsCache>(queryKey, (cache) =>
        updateQuestCommentPages(cache, (items) =>
          items.filter((item) => item.id !== commentId),
        ),
      )

      return { previous }
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
