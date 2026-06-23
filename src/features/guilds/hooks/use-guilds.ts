// Hook de lectura — obtiene los guilds del usuario autenticado.
// El loader de la ruta pre-carga la query en SSR, por lo que en el cliente
// los datos ya están en caché y no hay parpadeo de carga.
import { useQuery } from '@tanstack/react-query'

import { guildsQueryOptions } from '../api/guilds-query-options'

export function useGuilds() {
  return useQuery(guildsQueryOptions)
}
