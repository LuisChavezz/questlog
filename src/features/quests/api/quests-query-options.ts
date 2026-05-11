// Opciones de query para TanStack Query — quests
import { queryOptions } from '@tanstack/react-query'

import { getQuests } from './get-quests'

export const questsQueryOptions = queryOptions({
  queryKey: ['quests'],
  queryFn: () => getQuests(),
  staleTime: 1000 * 60, // 1 minuto
})
