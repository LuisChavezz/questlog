// Hook de mutación para actualizar una quest — incluye actualizaciones optimistas
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import type { Quest } from '#/db/schema'
import { updateQuest } from '../api/update-quest'
import { parseQuestDueDateValue } from '../schemas/quest-schemas'
import type { UpdateQuestValues } from '../schemas/quest-schemas'

/**
 * @param queryKey - Caché de quests sobre la que operar. Por defecto la lista
 * personal `['quests']`; la tabla de un guild pasa `['guild', slug, 'quests']`
 * para que la edición inline se refleje en la vista correcta.
 */
export function useUpdateQuest(queryKey: QueryKey = ['quests']) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateQuestValues) => updateQuest({ data }),

    // Aplicar el cambio en caché antes de recibir respuesta del servidor
    onMutate: async (variables) => {
      // Cancelar refetches en curso para evitar conflictos de estado
      await queryClient.cancelQueries({ queryKey })

      // Guardar snapshot para rollback en caso de error
      const previousQuests = queryClient.getQueryData<Quest[]>(queryKey)

      // Actualizar el caché optimistamente
      queryClient.setQueryData<Quest[]>(queryKey, (old = []) =>
        old.map((quest) => {
          if (quest.id !== variables.id) return quest

          return {
            ...quest,
            ...(variables.title !== undefined && { title: variables.title }),
            ...(variables.status !== undefined && {
              status: variables.status,
              completedAt: variables.status === 'done' ? new Date() : null,
            }),
            ...(variables.priority !== undefined && {
              priority: variables.priority,
            }),
            ...(variables.tags !== undefined && { tags: variables.tags }),
            ...(variables.dueDate !== undefined && {
              dueDate: parseQuestDueDateValue(variables.dueDate),
            }),
            // Asignado/supervisor: `undefined` omite; `null` limpia; un id fija.
            // Se parchean aquí para que la reasignación inline en la tabla de un
            // guild también sea optimista (misma fuente única que el resto).
            ...(variables.assigneeId !== undefined && {
              assigneeId: variables.assigneeId,
            }),
            ...(variables.supervisorId !== undefined && {
              supervisorId: variables.supervisorId,
            }),
          }
        }),
      )

      return { previousQuests }
    },

    // Revertir al snapshot si el servidor devuelve un error
    onError: (_err, _variables, context) => {
      if (context?.previousQuests) {
        queryClient.setQueryData(queryKey, context.previousQuests)
      }
    },

    // Sincronizar con el servidor independientemente del resultado
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
