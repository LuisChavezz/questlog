// Hook de mutación para eliminar múltiples quests — incluye actualizaciones optimistas
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import type { Quest } from '#/db/schema'
import { deleteQuests } from '../api/delete-quests'
import type { DeleteQuestsValues } from '../schemas/quest-schemas'

/**
 * @param queryKey - Caché de quests sobre la que operar. Por defecto la lista
 * personal `['quests']`; la tabla de un guild pasa `['guild', slug, 'quests']`
 * para que la eliminación masiva se refleje en la vista correcta.
 */
export function useBulkDeleteQuests(queryKey: QueryKey = ['quests']) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: DeleteQuestsValues) => {
      if (variables.ids.length === 0) {
        return Promise.resolve([])
      }

      return deleteQuests({ data: variables })
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey })

      const previousQuests = queryClient.getQueryData<Quest[]>(queryKey)

      // Quitar del caché todas las quests seleccionadas
      queryClient.setQueryData<Quest[]>(queryKey, (current = []) => {
        const selectedIds = new Set(variables.ids)

        return current.filter((quest) => !selectedIds.has(quest.id))
      })

      return { previousQuests }
    },

    onError: (_error, _variables, context) => {
      if (context?.previousQuests) {
        queryClient.setQueryData(queryKey, context.previousQuests)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
