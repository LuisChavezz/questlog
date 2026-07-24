import { createFileRoute } from '@tanstack/react-router'

import {
  guildQuestsQueryOptions,
  guildRecentActivityQueryOptions,
} from '#/features/guilds/api/guild-query-options'
import { GuildOverview } from '#/features/guilds/components/guild-overview'

export const Route = createFileRoute('/_app/guilds/$slug/')({
  // Precargamos la actividad reciente (tarjeta, SSR) y las quests del guild (el
  // drawer de detalle las resuelve por id). El detalle del guild ya lo precarga
  // la ruta padre ($slug.tsx).
  loader: ({ params, context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(guildRecentActivityQueryOptions(params.slug)),
      queryClient.ensureQueryData(guildQuestsQueryOptions(params.slug)),
    ]),
  component: GuildOverview,
})
