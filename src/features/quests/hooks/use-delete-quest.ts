// Hook de mutación para eliminar una quest — incluye actualizaciones optimistas
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Quest } from '#/db/schema'
import { deleteQuest } from '../api/delete-quest'
import type { DeleteQuestValues } from '../schemas/quest-schemas'

export function useDeleteQuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DeleteQuestValues) => deleteQuest({ data }),

    // Quitar la quest del caché antes de recibir respuesta del servidor
    onMutate: async (variables) => {
      // Cancelar refetches en curso para evitar conflictos de estado
      await queryClient.cancelQueries({ queryKey: ['quests'] })

      // Guardar snapshot para rollback en caso de error
      const previousQuests = queryClient.getQueryData<Quest[]>(['quests'])

      // Actualizar el caché optimistamente
      queryClient.setQueryData<Quest[]>(['quests'], (old = []) =>
        old.filter((quest) => quest.id !== variables.id),
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
