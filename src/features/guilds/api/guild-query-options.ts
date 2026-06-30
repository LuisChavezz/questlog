// Opciones de query para TanStack Query — detalle de un guild
// Compartidas por el loader de la ruta (SSR) y los componentes (cliente)
import { queryOptions } from '@tanstack/react-query'

import { getGuild } from './get-guild'

export const guildQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['guild', slug],
    queryFn: () => getGuild({ data: { slug } }),
    staleTime: 1000 * 20, // 20 segundos
  })
