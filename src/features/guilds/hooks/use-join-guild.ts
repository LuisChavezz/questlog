// Hook de mutación para unirse a un guild desde la pantalla de invitación.
// Al completar, refresca la lista de guilds del usuario y navega al detalle.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { joinGuild } from '../api/join-guild'

export function useJoinGuild() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => joinGuild({ data: { code } }),
    onSuccess: async ({ slug }) => {
      // Invalidar la lista de guilds para que el nuevo aparezca en sidebar/grid
      await queryClient.invalidateQueries({ queryKey: ['guilds'] })
      await navigate({ to: '/guilds/$slug', params: { slug } })
    },
  })
}
