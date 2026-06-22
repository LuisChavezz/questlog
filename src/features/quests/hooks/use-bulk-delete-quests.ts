// Hook de mutación para eliminar múltiples quests — incluye actualizaciones optimistas
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Quest } from '#/db/schema'
import { deleteQuests } from '../api/delete-quests'
import type { DeleteQuestsValues } from '../schemas/quest-schemas'

export function useBulkDeleteQuests() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: DeleteQuestsValues) => {
      if (variables.ids.length === 0) {
        return Promise.resolve([])
      }

      return deleteQuests({ data: variables })
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['quests'] })

      const previousQuests = queryClient.getQueryData<Quest[]>(['quests'])

      // Quitar del caché todas las quests seleccionadas
      queryClient.setQueryData<Quest[]>(['quests'], (current = []) => {
        const selectedIds = new Set(variables.ids)

        return current.filter((quest) => !selectedIds.has(quest.id))
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
