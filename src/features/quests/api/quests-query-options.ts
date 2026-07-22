// Opciones de query para TanStack Query — quests
import { queryOptions } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

import { getQuestGuilds } from './get-quest-guilds'
import { getQuests } from './get-quests'

// Clave de la lista personal, exportada porque `/quests` la pasa explícitamente
// a cada una de sus tablas: sus secciones de guild leen de esta caché y no de
// `['guild', slug, 'quests']`, que es la que alimenta la página del guild.
export const QUESTS_QUERY_KEY: QueryKey = ['quests']

export const questsQueryOptions = queryOptions({
  queryKey: QUESTS_QUERY_KEY,
  queryFn: () => getQuests(),
  staleTime: 1000 * 20, // 20 segundos
})

// Clave hermana (no anidada dentro de `['quests']`) a propósito: los hooks de
// mutación invalidan y parchean `['quests']` asumiendo que contiene un array de
// `Quest`, y una clave hija quedaría atrapada en esas invalidaciones por
// prefijo. La composición de los guilds solo cambia al entrar o salir de uno,
// no al editar una quest.
export const QUEST_GUILDS_QUERY_KEY: QueryKey = ['quest-guilds']

export const questGuildsQueryOptions = queryOptions({
  queryKey: QUEST_GUILDS_QUERY_KEY,
  queryFn: () => getQuestGuilds(),
  staleTime: 1000 * 60, // 1 minuto
})
