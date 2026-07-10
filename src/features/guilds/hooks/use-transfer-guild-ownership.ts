// Hook de mutación — transfiere la propiedad del guild a otro miembro.
// Al completar, invalida el detalle del guild y el directorio de guilds. Como
// getGuild recalcula `currentUserRole` desde la fila de membresía del usuario
// de la sesión, el refetch del detalle devuelve el nuevo rol del ex-owner
// (`member`): la UI oculta de inmediato las acciones owner-only (invitar,
// cambiar rol, transferir) sin necesidad de recargar. El directorio también se
// invalida porque su badge de rol por guild proviene de una query separada
// (['guilds']) que, de lo contrario, seguiría mostrando "Guild Master" hasta su
// próximo refetch. Los errores quedan en el estado de la mutación.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { transferGuildOwnership } from '../api/transfer-guild-ownership'

export function useTransferGuildOwnership(
  slug: string,
  onSuccess?: () => void,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newOwnerUserId: string) =>
      transferGuildOwnership({ data: { slug, newOwnerUserId } }),
    onSuccess: async () => {
      // Refrescar el detalle del guild (incluye rol propio y lista de miembros)
      // y el directorio (badge de rol por guild) en paralelo — son cachés
      // independientes que este cambio afecta a la vez. exact: true en la
      // primera evita invalidar de paso la key hermana ['guild', slug,
      // 'quests'], que no tiene relación con una transferencia de propiedad.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['guild', slug],
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
      ])
      onSuccess?.()
    },
  })
}
