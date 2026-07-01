import { Button } from '#/components/ui/button'
import { GuildEmblem } from './guild-emblem'

type GuildsEmptyStateProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// `open` se mantiene en las props por simetría con el diálogo; aquí solo se
// necesita `onOpenChange` para abrirlo desde el CTA del estado vacío.
export function GuildsEmptyState({ onOpenChange }: GuildsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="rounded-2xl bg-primary/5 p-6">
        <GuildEmblem />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground">No guilds yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create a guild to start collaborating with your team on quests.
        </p>
      </div>
      <Button onClick={() => onOpenChange(true)}>Create Guild</Button>
    </div>
  )
}
