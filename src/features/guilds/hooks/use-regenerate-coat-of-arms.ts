// Hook de mutación — regenera (o genera por primera vez) el escudo de armas
// del guild. Al completar, invalida el detalle del guild y el directorio: la
// card de guilds-grid también renderiza el escudo, y ambas cachés deben
// reflejar el nuevo diseño de inmediato. Los errores quedan en el estado de
// la mutación (ver regenerate-coat-of-arms.handler.ts sobre por qué un fallo
// de Armoria se propaga en vez de tragarse en silencio, a diferencia de la
// generación en create-guild.ts).
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { regenerateCoatOfArms } from '../api/regenerate-coat-of-arms'

export function useRegenerateCoatOfArms(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => regenerateCoatOfArms({ data: { slug } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['guild', slug],
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
      ])
    },
  })
}
