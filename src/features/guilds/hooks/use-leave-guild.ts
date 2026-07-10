// Hook de mutación — abandona un guild. Al completar, navega al directorio
// (el usuario ya no puede ver un guild al que no pertenece), limpia el detalle
// del guild del caché y refresca la lista de guilds para que desaparezca de
// inmediato. Los errores quedan en el estado de la mutación.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { leaveGuild } from '../api/leave-guild'

export function useLeaveGuild(slug: string, onSuccess?: () => void) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => leaveGuild({ data: { slug } }),
    onSuccess: async () => {
      // Cerrar el diálogo antes de navegar
      onSuccess?.()
      // Invalidar el directorio ANTES de navegar: si su query sigue "fresca"
      // (staleTime), llegar a /guilds sin esto mostraría por un instante el
      // guild que se acaba de abandonar, hasta que algo más disparase su refetch.
      await queryClient.invalidateQueries({ queryKey: ['guilds'] })
      // Salir de la página del guild recién ahora, para que su useQuery se
      // desmonte y no dispare un refetch que fallaría ("no eres miembro")
      await navigate({ to: '/guilds' })
      // Ya fuera: descartar el detalle del guild del caché
      queryClient.removeQueries({ queryKey: ['guild', slug] })
    },
  })
}
