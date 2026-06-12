import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import { updateQuest } from '../api/update-quest'

type BulkUpdateQuestValues =
  | {
      ids: string[]
      status: QuestStatus
    }
  | {
      ids: string[]
      priority: QuestPriority
    }

export function useBulkUpdateQuests() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: BulkUpdateQuestValues) => {
      if (variables.ids.length === 0) {
        return []
      }

      return Promise.all(
        variables.ids.map((id) => updateQuest({ data: { id, ...getBulkUpdatePatch(variables) } })),
      )
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['quests'] })

      const previousQuests = queryClient.getQueryData<Quest[]>(['quests'])

      queryClient.setQueryData<Quest[]>(['quests'], (current = []) => {
        const selectedIds = new Set(variables.ids)

        return current.map((quest) => {
          if (!selectedIds.has(quest.id)) {
            return quest
          }

          if ('status' in variables) {
            return {
              ...quest,
              status: variables.status,
              completedAt: variables.status === 'done' ? new Date() : null,
            }
          }

          return {
            ...quest,
            priority: variables.priority,
          }
        })
      })

      return { previousQuests }
    },

    onError: (_error, _variables, context) => {
      if (context?.previousQuests) {
        queryClient.setQueryData(['quests'], context.previousQuests)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] })
    },
  })
}

function getBulkUpdatePatch(variables: BulkUpdateQuestValues) {
  if ('status' in variables) {
    return { status: variables.status }
  }

  return { priority: variables.priority }
}