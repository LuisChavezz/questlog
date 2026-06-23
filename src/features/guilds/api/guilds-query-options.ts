// Opciones de query para TanStack Query — guilds.
// Compartidas por el loader de la ruta (SSR) y el hook useGuilds (cliente)
// para mantener una única clave y queryFn.
import { queryOptions } from '@tanstack/react-query'

import { getGuilds } from './get-guilds'

export const guildsQueryOptions = queryOptions({
  queryKey: ['guilds'],
  queryFn: () => getGuilds(),
  staleTime: 1000 * 20, // 20 segundos
})
