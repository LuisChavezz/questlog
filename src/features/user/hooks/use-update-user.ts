// Hook de mutación para actualizar el perfil del usuario vía Better Auth.
// `authClient.updateUser` ya dispara `$sessionSignal` internamente, por lo
// que `authClient.useSession()` se refresca solo tras el éxito.
import { useMutation } from '@tanstack/react-query'

import { authClient } from '#/lib/auth-client'
import type { UpdateUserValues } from '../schemas/user-schemas'

// `onSuccess` se invoca tras actualizar el perfil correctamente.
// Los errores quedan expuestos en el estado de la mutación (`error`/`isError`)
// para que el formulario los muestre sin romper la app.
export function useUpdateUser(onSuccess?: () => void) {
  return useMutation({
    mutationFn: async (data: UpdateUserValues) => {
      const { error } = await authClient.updateUser(data)

      if (error) {
        throw new Error(error.message ?? 'Something went wrong. Please try again.')
      }
    },

    onSuccess: () => {
      onSuccess?.()
    },
  })
}
