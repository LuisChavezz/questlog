import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/guilds/$slug/members')({
  component: GuildMembersPage,
})

function GuildMembersPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">Coming soon</p>
    </div>
  )
}
