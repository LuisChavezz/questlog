import { useState } from 'react'

import { Button } from '#/components/ui/button'

import { useGuilds } from '../hooks/use-guilds'
import { CreateGuildDialog } from './create-guild-dialog'
import { GuildsEmptyState } from './guilds-empty-state'
import { GuildsGrid } from './guilds-grid'

export function GuildsPage() {
  // Datos pre-cargados en SSR por el loader de la ruta; sin parpadeo de carga.
  const { data: guilds = [] } = useGuilds()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Guilds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborate with others by joining or creating a guild.
          </p>
        </div>
        {guilds.length > 0 && (
          <Button onClick={() => setDialogOpen(true)}>Create Guild</Button>
        )}
      </header>

      {guilds.length === 0 ? (
        <GuildsEmptyState open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : (
        <GuildsGrid guilds={guilds} />
      )}

      <CreateGuildDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
