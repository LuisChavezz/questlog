// Invalidación de cachés tras mutar una quest de guild. Único lugar para
// "¿qué cachés quedan obsoletas al editar/borrar una quest de guild?", usado
// tanto por la tabla de quests (`quests-table.tsx`) como por el drawer del
// Overview (`use-guild-activity-drawer.tsx`), para que no puedan divergir.
import type { QueryClient } from '@tanstack/react-query'

import { QUESTS_QUERY_KEY } from './quests-query-options'

// Invalida el detalle/actividad del guild (`['guild', slug]`, prefijo que cubre
// stats, miembros, actividad reciente e historial) y, si procede, la lista
// personal de quests (`['quests']`). La lista personal muestra quests de guild
// (las que el usuario creó o supervisa), así que una edición desde un guild
// también la deja obsoleta; se omite solo cuando el llamador ya la invalida por
// su cuenta (las secciones de `/quests`, que fijan `questsQueryKey`). No se filtra
// por si la quest es visible en la lista personal: invalidar solo la marca como
// obsoleta y el refetch ya devuelve únicamente lo visible, así que gatearlo por
// propiedad/supervisión no aportaría nada y sí arriesgaría dejar datos rancios.
export function invalidateGuildQuestCaches(
  queryClient: QueryClient,
  slug: string,
  options: { includePersonalQuests: boolean },
) {
  queryClient.invalidateQueries({ queryKey: ['guild', slug] })

  if (options.includePersonalQuests) {
    queryClient.invalidateQueries({ queryKey: QUESTS_QUERY_KEY })
  }
}
