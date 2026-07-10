// Hook de mutación — expulsa a un miembro del guild. Al completar, invalida el
// detalle del guild para que la lista de miembros se actualice. Los errores
// quedan en el estado de la mutación para que la UI los muestre.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { removeGuildMember } from '../api/remove-guild-member'

export function useRemoveGuildMember(slug: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      removeGuildMember({ data: { slug, userId } }),
    onSuccess: async () => {
      // Refrescar el detalle del guild (incluye la lista de miembros). exact:
      // true evita invalidar de paso la key hermana ['guild', slug, 'quests'],
      // que no tiene relación con una expulsión.
      await queryClient.invalidateQueries({
        queryKey: ['guild', slug],
        exact: true,
      })
      onSuccess?.()
    },
  })
}
