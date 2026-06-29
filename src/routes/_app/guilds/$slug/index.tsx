import { createFileRoute } from '@tanstack/react-router'

import { GuildOverview } from '#/features/guilds/components/guild-overview'

export const Route = createFileRoute('/_app/guilds/$slug/')({
  component: GuildOverview,
})
