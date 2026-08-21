// Hook de mutación — edita el perfil del guild (nombre y descripción). Sin
// actualización optimista a propósito: esto es el submit de un formulario, no
// una edición inline, así que no hay una fila que deba "moverse" antes de que
// el servidor conteste — el usuario ya ve sus valores en los inputs.
//
// Al completar invalida el detalle del guild y el directorio: el nombre y la
// descripción se renderizan en ambos lados (cabecera de `/guilds/$slug` y card
// de guilds-grid), y dejar el directorio fresco pintaría el nombre viejo al
// volver a él. El detalle se invalida por PREFIJO (sin `exact`), así que las
// sub-páginas que cuelgan de `['guild', slug]` — quests y actividad — también
// se revalidan; no dependen del nombre, pero mantiene una sola regla en vez de
// una lista de excepciones.
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateGuild } from '../api/update-guild'
import type { GuildProfileFormValues } from '../schemas/guild-schemas'

export function useUpdateGuild(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: GuildProfileFormValues) =>
      updateGuild({ data: { ...values, slug } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guild', slug] }),
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
      ])
    },
  })
}
