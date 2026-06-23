import { createFileRoute } from '@tanstack/react-router'

import { guildsQueryOptions } from '#/features/guilds/api/guilds-query-options'
import { GuildsPage } from '#/features/guilds/components/guilds-page'

export const Route = createFileRoute('/_app/guilds/')({
  // Pre-carga los guilds en el servidor antes de enviar el HTML al cliente
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(guildsQueryOptions),
  component: GuildsPage,
})
