import { GuildsEmptyState } from './guilds-empty-state'

export function GuildsPage() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Guilds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collaborate with others by joining or creating a guild.
        </p>
      </header>
      <GuildsEmptyState />
    </div>
  )
}
