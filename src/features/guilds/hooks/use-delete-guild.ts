// Hook de mutación — borra el guild por completo. Al completar navega al
// directorio (el guild ya no existe, quedarse en su página dispararía un refetch
// condenado a fallar), refresca las cachés que el borrado deja obsoletas y, ya
// fuera, descarta el detalle del guild. Mismo orden que `useLeaveGuild`, del que
// solo se separa en las dos cachés extra que un borrado sí invalida y una salida
// no: las quests del guild desaparecen con él.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import {
  QUEST_GUILDS_QUERY_KEY,
  QUESTS_QUERY_KEY,
} from '#/features/quests/api/quests-query-options'
import { deleteGuild } from '../api/delete-guild'

export function useDeleteGuild(slug: string, onSuccess?: () => void) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteGuild({ data: { slug } }),
    onSuccess: async () => {
      // Cerrar el diálogo antes de navegar
      onSuccess?.()
      // Invalidar ANTES de navegar: si estas queries siguen "frescas"
      // (staleTime), llegar a /guilds o a /quests sin esto mostraría por un
      // instante el guild recién borrado y sus quests, hasta que algo más
      // disparase su refetch.
      // - ['guilds']: el directorio, que lo listaría.
      // - ['quests']: la lista personal incluye quests de guild (creadas,
      //   asignadas o supervisadas por el usuario) y todas se fueron con él.
      // - ['quest-guilds']: los encabezados de sección por guild de esa lista
      //   viven en una caché hermana propia, que si no seguiría pintando una
      //   sección de un guild inexistente.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
        queryClient.invalidateQueries({ queryKey: QUESTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: QUEST_GUILDS_QUERY_KEY }),
      ])
      // Salir de la página del guild recién ahora, para que sus useQuery se
      // desmonten y no disparen un refetch que fallaría ("guild not found")
      await navigate({ to: '/guilds' })
      // Ya fuera: descartar el detalle del guild del caché. Sin `exact`, el
      // prefijo se lleva también sus claves hijas (quests, actividad reciente e
      // historial), que murieron con el guild.
      queryClient.removeQueries({ queryKey: ['guild', slug] })
    },
  })
}
