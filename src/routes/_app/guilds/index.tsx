import { createFileRoute } from '@tanstack/react-router'

import { GuildsPage } from '#/features/guilds/components/guilds-page'

export const Route = createFileRoute('/_app/guilds/')({
  component: GuildsPage,
})
