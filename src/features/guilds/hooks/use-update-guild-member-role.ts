// Hook de mutación — cambia el rol de un miembro del guild. Al completar,
// invalida el detalle del guild para reflejar el nuevo rol. Los errores quedan
// en el estado de la mutación para que la UI los muestre sin romper la app.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateGuildMemberRole } from '../api/update-guild-member-role'
import type { AssignableGuildRole } from '../schemas/guild-schemas'

interface UpdateMemberRoleInput {
  userId: string
  newRole: AssignableGuildRole
}

export function useUpdateGuildMemberRole(slug: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateMemberRoleInput) =>
      updateGuildMemberRole({ data: { slug, ...input } }),
    onSuccess: async () => {
      // Refrescar el detalle del guild (incluye la lista de miembros). exact:
      // true evita invalidar de paso la key hermana ['guild', slug, 'quests'],
      // que no tiene relación con un cambio de rol.
      await queryClient.invalidateQueries({
        queryKey: ['guild', slug],
        exact: true,
      })
      onSuccess?.()
    },
  })
}
