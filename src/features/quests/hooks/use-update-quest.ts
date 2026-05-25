// Hook de mutación para actualizar una quest — incluye actualizaciones optimistas
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Quest } from '#/db/schema'
import { updateQuest } from '../api/update-quest'
import type { UpdateQuestValues } from '../schemas/quest-schemas'

export function useUpdateQuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateQuestValues) => updateQuest({ data }),

    // Aplicar el cambio en caché antes de recibir respuesta del servidor
    onMutate: async (variables) => {
      // Cancelar refetches en curso para evitar conflictos de estado
      await queryClient.cancelQueries({ queryKey: ['quests'] })

      // Guardar snapshot para rollback en caso de error
      const previousQuests = queryClient.getQueryData<Quest[]>(['quests'])

      // Actualizar el caché optimistamente
      queryClient.setQueryData<Quest[]>(['quests'], (old = []) =>
        old.map((quest) => {
          if (quest.id !== variables.id) return quest

          return {
            ...quest,
            ...(variables.title !== undefined && { title: variables.title }),
            ...(variables.status !== undefined && {
              status: variables.status,
              completedAt: variables.status === 'done' ? new Date() : null,
            }),
            ...(variables.priority !== undefined && { priority: variables.priority }),
            ...(variables.tags !== undefined && { tags: variables.tags }),
          }
        }),
      )

      return { previousQuests }
    },

    // Revertir al snapshot si el servidor devuelve un error
    onError: (_err, _variables, context) => {
      if (context?.previousQuests) {
        queryClient.setQueryData(['quests'], context.previousQuests)
      }
    },

    // Sincronizar con el servidor independientemente del resultado
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] })
    },
  })
}
