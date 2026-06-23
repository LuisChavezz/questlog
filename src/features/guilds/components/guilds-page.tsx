import { useGuilds } from '../hooks/use-guilds'
import { GuildsEmptyState } from './guilds-empty-state'
import { GuildsGrid } from './guilds-grid'

export function GuildsPage() {
  // Datos pre-cargados en SSR por el loader de la ruta; sin parpadeo de carga.
  const { data: guilds = [] } = useGuilds()

  return (
    <div className="flex flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Guilds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collaborate with others by joining or creating a guild.
        </p>
      </header>

      {guilds.length === 0 ? (
        <GuildsEmptyState />
      ) : (
        <GuildsGrid guilds={guilds} />
      )}
    </div>
  )
}
