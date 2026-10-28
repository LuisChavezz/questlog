import { createFileRoute } from '@tanstack/react-router'

import { GuildSettingsPage } from '#/features/guilds/components/guild-settings-page'

export const Route = createFileRoute('/_app/guilds/$slug/settings')({
  component: GuildSettingsPage,
})
