/**
 * GuildsGrid — cuadrícula responsiva de tarjetas de guild.
 * 1 columna en móvil, 2 en md y 3 en lg.
 */
import type { GuildWithRole } from '../api/get-guilds'
import { GuildCard } from './guild-card'

type GuildsGridProps = {
  guilds: GuildWithRole[]
}

export function GuildsGrid({ guilds }: GuildsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {guilds.map((guild) => (
        <GuildCard key={guild.id} guild={guild} />
      ))}
    </div>
  )
}
