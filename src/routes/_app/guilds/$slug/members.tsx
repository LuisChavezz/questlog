import { createFileRoute } from '@tanstack/react-router'

import { GuildMembersPage } from '#/features/guilds/components/guild-members-page'

export const Route = createFileRoute('/_app/guilds/$slug/members')({
  component: GuildMembersPage,
})
