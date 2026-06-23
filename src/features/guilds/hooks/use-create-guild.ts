// Hook de mutación para crear un guild
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createGuild } from '../api/create-guild'
import type { CreateGuildValues } from '../schemas/guild-schemas'

// `onSuccess` se invoca tras crear el guild: se usa para cerrar el modal.
// Los errores quedan expuestos en el estado de la mutación (`error`/`isError`)
// para que el formulario los muestre sin romper la app.
export function useCreateGuild(onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGuildValues) => createGuild({ data }),

    onSuccess: async () => {
      // Refrescar el listado de guilds y cerrar el modal
      await queryClient.invalidateQueries({ queryKey: ['guilds'] })
      onSuccess?.()
    },
  })
}
